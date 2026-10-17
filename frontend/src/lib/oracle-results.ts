import { parseRoute } from "./route-contract";
import type { DataStatus, JsonValue, OracleResult, ResultMetadata, ScheduleEntry } from "../types/oracle";

const statuses: DataStatus[] = ["synthetic_estimate", "database", "estimated", "default_fallback", "unknown"];
const levels = ["LOW", "MEDIUM", "HIGH"];
const clock = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const invalid = () => { throw new Error("Invalid Oracle result"); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) return invalid();
  return value.trim();
}
function number(value: unknown, positive = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) return invalid();
  return value;
}
function time(value: unknown): string {
  if (typeof value !== "string" || !clock.test(value)) return invalid();
  return value;
}
function level(value: unknown): "LOW" | "MEDIUM" | "HIGH" {
  if (typeof value !== "string" || !levels.includes(value)) return invalid();
  return value as "LOW" | "MEDIUM" | "HIGH";
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) return invalid();
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const days = new Date(0); days.setUTCFullYear(year, month, 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days.getUTCDate()) return invalid();
  return value;
}
function optional<T>(value: unknown, validate: (value: unknown) => T): T | undefined {
  return value === null || value === undefined ? undefined : validate(value);
}
function metadata(item: Record<string, unknown>): ResultMetadata {
  if (typeof item.data_status !== "string" || !statuses.includes(item.data_status as DataStatus)) return invalid();
  const observed = optional(item.observed_at, timestamp), calculated = optional(item.calculated_at, timestamp);
  return { title: text(item.title, 160), source: text(item.source, 200), data_status: item.data_status as DataStatus,
    disclaimer: text(item.disclaimer, 2000), ...(observed ? { observed_at: observed } : {}), ...(calculated ? { calculated_at: calculated } : {}) };
}
function jsonData(value: unknown, depth = 0, budget = { nodes: 0 }): JsonValue {
  if (depth > 6 || ++budget.nodes > 1000) return invalid();
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => jsonData(item, depth + 1, budget));
  return Object.fromEntries(Object.entries(object(value)).map(([key, item]) => [key, jsonData(item, depth + 1, budget)]));
}
function parseResult(value: unknown): OracleResult {
  const item = object(value);
  // Bound rendering work and retain no raw rejected payload in display state.
  const serialized = JSON.stringify(item);
  if (new TextEncoder().encode(serialized).length > 16000) return invalid();
  const meta = metadata(item), data = object(item.data);
  if (item.type === "congestion") {
    const segment = text(data.segment_id, 6);
    const name = optional(data.segment_name, value => text(value, 256));
    if (!/^SEG00[1-6]$/.test(segment) || !["weekday", "weekend"].includes(String(data.day_type))
        || typeof data.day_type !== "string" || !Number.isInteger(data.hour) || number(data.hour) > 23) return invalid();
    return { ...meta, type: "congestion", data: { segment_id: segment, ...(name !== undefined ? { segment_name: name } : {}), day_type: data.day_type as "weekday" | "weekend",
      hour: data.hour as number, congestion_level: level(data.congestion_level), multiplier: number(data.multiplier, true) } };
  }
  if (item.type === "schedule") {
    if (!Array.isArray(data.schedules) || data.schedules.length > 100) return invalid();
    const schedules = data.schedules.map(value => {
      const row = object(value);
      const entry: ScheduleEntry = { terminal: text(row.terminal, 256), destination: text(row.destination, 256), departure_time: time(row.departure_time) };
      const cutoff = optional(row.cutoff_time, time), vessel = optional(row.vessel_type, value => text(value, 256)), capacity = optional(row.cargo_capacity_tons, number);
      if (cutoff !== undefined) entry.cutoff_time = cutoff;
      if (vessel !== undefined) entry.vessel_type = vessel;
      if (capacity !== undefined) entry.cargo_capacity_tons = capacity;
      return entry;
    });
    return { ...meta, type: "schedule", data: { schedules } };
  }
  if (item.type === "route") {
    const route = parseRoute(data);
    return { ...meta, type: "route", data: route };
  }
  if (item.type === "generic") return { ...meta, type: "generic", data: jsonData(data) as { [key: string]: JsonValue } };
  return invalid();
}

export function parseResults(values: unknown[]): { results: OracleResult[]; unavailable: number } {
  if (!Array.isArray(values) || values.length > 12) throw new Error("Invalid Oracle result collection");
  const results: OracleResult[] = []; let unavailable = 0;
  for (const value of values) { try { results.push(parseResult(value)); } catch { unavailable++; } }
  return { results, unavailable };
}

export const resultStatusLabels: Record<DataStatus, string> = {
  synthetic_estimate: "Synthetic estimate", database: "Recorded data", estimated: "Estimate",
  default_fallback: "Assumed default", unknown: "Source status unknown",
};
