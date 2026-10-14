import type { DataStatus, JsonValue, LocationPoint, OracleResult, ResultMetadata, RouteData, RouteGeometry, ScheduleEntry } from "../types/oracle";

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
function coordinate(value: unknown, limit: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > limit) return invalid();
  return value;
}
function point(value: unknown): LocationPoint {
  const row = object(value); return { lat: coordinate(row.lat, 90), lng: coordinate(row.lng, 180) };
}
function geometry(value: unknown): RouteGeometry {
  const row = object(value);
  if (row.type !== "LineString" || !Array.isArray(row.coordinates) || row.coordinates.length < 2 || row.coordinates.length > 160) return invalid();
  return { type: "LineString", coordinates: row.coordinates.map(value => {
    if (!Array.isArray(value) || value.length !== 2) return invalid();
    return [coordinate(value[0], 180), coordinate(value[1], 90)];
  }) };
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) return invalid();
  return value as T;
}
function calendarDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid();
  timestamp(`${value}T00:00:00Z`); return value;
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
    const route: RouteData = { distance_km: number(data.distance_km), final_time_min: number(data.final_time_min), routing_source: text(data.routing_source, 200) };
    const optionalFields = {
      base_time_min: optional(data.base_time_min, number), emission_kg: optional(data.emission_kg, number),
      congestion_level: optional(data.congestion_level, level), congestion_multiplier: optional(data.congestion_multiplier, value => number(value, true)),
      matched_segment_id: optional(data.matched_segment_id, value => text(value, 80)),
      matched_segment_name: optional(data.matched_segment_name, value => text(value, 256)),
      latest_gate_in: optional(data.latest_gate_in, time), optimal_departure: optional(data.optimal_departure, time),
      origin: optional(data.origin, point), destination: optional(data.destination, point),
      origin_name: optional(data.origin_name, value => text(value, 256)), destination_name: optional(data.destination_name, value => text(value, 256)),
      route_geometry: optional(data.route_geometry, geometry), departure_time: optional(data.departure_time, time),
      departure_date: optional(data.departure_date, calendarDate),
      planning_timezone: optional(data.planning_timezone, value => choice(value, ["Asia/Jakarta"] as const)),
      day_type: optional(data.day_type, value => choice(value, ["weekday", "weekend"] as const)),
      cargo_type: optional(data.cargo_type, value => choice(value, ["CONTAINER", "FAST_FREIGHT"] as const)),
      vessel_etd: optional(data.vessel_etd, value => typeof value === "string" && value.includes("T") ? timestamp(value) : time(value)),
      departure_datetime: optional(data.departure_datetime, timestamp), latest_gate_in_datetime: optional(data.latest_gate_in_datetime, timestamp),
      optimal_departure_datetime: optional(data.optimal_departure_datetime, timestamp),
      departure_feasible: optional(data.departure_feasible, value => typeof value === "boolean" ? value : invalid()),
      planning_warning: optional(data.planning_warning, value => text(value, 2000)),
      congestion_status: optional(data.congestion_status, value => choice(value, ["synthetic_estimate", "default_fallback", "unavailable"] as const)),
    };
    for (const [key, value] of Object.entries(optionalFields)) if (value !== undefined) Object.assign(route, { [key]: value });
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
