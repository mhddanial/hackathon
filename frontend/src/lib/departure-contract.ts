import type { DeparturePlan, DepartureResult, ScheduleView, DepartureAlternative, RouteEstimate, RecordedSailing } from "../types/departure";

const terminals = ["batu_ampar", "batam_center", "sekupang"] as const;
const services = ["cargo", "passenger_hand_carry"] as const;
const unavailableCodes = ["NO_SCHEDULES", "NO_RELEVANT_SCHEDULES", "NO_EVALUABLE_SCHEDULES", "MISSING_SERVICE_DATE", "MISSING_SOURCE_ZONE", "INVALID_SOURCE_ZONE", "MISSING_DEPARTURE", "INVALID_SCHEDULE", "MISSING_CUTOFF", "INVALID_CUTOFF", "SERVICE_UNKNOWN", "FRESHNESS_UNKNOWN", "INVALID_FRESHNESS", "STALE_SCHEDULE", "AMBIGUOUS_SCHEDULE", "ROUTE_FALLBACK", "CONGESTION_UNAVAILABLE", "ROUTE_CONTEXT_UNKNOWN", "CANDIDATE_LIMIT"] as const;
const fail = (): never => { throw new Error("The planning service response could not be validated. Please retry."); };
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function exact(value: unknown, keys: string): Record<string, unknown> {
  const row = record(value), expected = keys.split(" ");
  if (Object.keys(row).length !== expected.length || expected.some(k => !Object.hasOwn(row, k))) return fail();
  return row;
}
export function boundedText(value: unknown, max = 80): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) return fail();
  return value;
}
function numeric(value: unknown, min = -Infinity, max = Infinity): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return fail();
  return value;
}
function positive(value: unknown) { const n = numeric(value); return n > 0 ? n : fail(); }
function bool(value: unknown): boolean { return typeof value === "boolean" ? value : fail(); }
function one<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== "string" || !choices.includes(value as T)) return fail();
  return value as T;
}
function list<T>(value: unknown, max: number, parse: (value: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) return fail();
  return value.map(parse);
}
const nullable = <T>(value: unknown, parse: (v: unknown) => T): T | null => value === null ? null : parse(value);
export function uuid(value: unknown): string {
  const s = boundedText(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ? s : fail();
}
export function calendarDate(value: unknown): string {
  const s = boundedText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return fail();
  const [year, month, day] = s.split("-").map(Number), date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year > 0 && date.toISOString().slice(0, 10) === s ? s : fail();
}
function timestamp(value: unknown, jakarta = true): string {
  const s = boundedText(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(s) || !Number.isFinite(Date.parse(s)) || (jakarta && !s.endsWith("+07:00"))) return fail();
  calendarDate(s.slice(0, 10));
  return s;
}
function zone(value: unknown): string {
  const s = boundedText(value);
  try { new Intl.DateTimeFormat("en", { timeZone: s }).format(); } catch { return fail(); }
  return s;
}
export const dayType = (date: string): "weekday" | "weekend" => {
  const day = new Date(`${calendarDate(date)}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6 ? "weekend" : "weekday";
};
export function parseDeparturePlan(value: unknown): DeparturePlan {
  const r = exact(value, "origin origin_name terminal ferry_destination departure_date departure_time service_date service_kind day_type schedule_id");
  const p = exact(r.origin, "lat lng"), date = calendarDate(r.departure_date), service = calendarDate(r.service_date);
  const diff = (Date.parse(`${service}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000;
  if (diff !== 0 && diff !== 1) return fail();
  const time = boundedText(r.departure_time, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || r.day_type !== dayType(date)) return fail();
  return { origin: { lat: numeric(p.lat, .7, 1.25), lng: numeric(p.lng, 103.8, 104.3) }, origin_name: nullable(r.origin_name, v => boundedText(v, 256)), terminal: one(r.terminal, terminals), ferry_destination: boundedText(r.ferry_destination, 80).trim().replace(/\s+/g, " "), departure_date: date, departure_time: time, service_date: service, service_kind: one(r.service_kind, services), day_type: dayType(date), schedule_id: nullable(r.schedule_id, uuid) };
}
function schedule(value: unknown, complete: boolean): ScheduleView {
  const r = exact(value, "schedule_id occurrence_id terminal destination service_date allowed_service_kinds source_timezone source_departure_at source_cutoff_at departure_at cutoff_at verified_at source");
  const s: ScheduleView = {
    schedule_id: nullable(r.schedule_id, uuid), occurrence_id: nullable(r.occurrence_id, v => boundedText(v)), terminal: nullable(r.terminal, v => one(v, terminals)), destination: nullable(r.destination, v => boundedText(v)), service_date: nullable(r.service_date, calendarDate), allowed_service_kinds: nullable(r.allowed_service_kinds, v => list(v, 2, x => one(x, services))), source_timezone: nullable(r.source_timezone, zone), source_departure_at: nullable(r.source_departure_at, v => timestamp(v, false)), source_cutoff_at: nullable(r.source_cutoff_at, v => timestamp(v, false)), departure_at: nullable(r.departure_at, timestamp), cutoff_at: nullable(r.cutoff_at, timestamp), verified_at: nullable(r.verified_at, v => timestamp(v, false)), source: nullable(r.source, v => one(v, ["database", "synthetic_fixture"] as const)),
  };
  if (complete) {
    if (Object.values(s).some(v => v === null) || !s.allowed_service_kinds?.length || s.occurrence_id !== `${s.schedule_id}@${s.service_date}` || s.departure_at!.slice(0, 10) !== s.service_date || Date.parse(s.cutoff_at!) >= Date.parse(s.departure_at!) || Date.parse(s.source_departure_at!) !== Date.parse(s.departure_at!) || Date.parse(s.source_cutoff_at!) !== Date.parse(s.cutoff_at!)) return fail();
    for (const at of [s.source_departure_at!, s.source_cutoff_at!]) {
      const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: s.source_timezone!, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(at)).replace(" ", "T");
      if (parts !== at.slice(0, 19)) return fail();
    }
  }
  return s;
}
function route(value: unknown): RouteEstimate {
  const r = exact(value, "final_time_min routing_source congestion_status context_verified estimated_arrival_at");
  return { final_time_min: numeric(r.final_time_min, 0, 1440), routing_source: boundedText(r.routing_source), congestion_status: nullable(r.congestion_status, v => one(v, ["synthetic_estimate", "default_fallback", "unavailable"] as const)), context_verified: bool(r.context_verified), estimated_arrival_at: timestamp(r.estimated_arrival_at) };
}
const reasonFor = { SAFE: "BUFFER_SUFFICIENT", RISKY: "BELOW_SAFETY_BUFFER", MISSED: "CUTOFF_MISSED" } as const;
// Validate backend decisions; never substitute a client-calculated recommendation.
function verifyDecision(s: ScheduleView, status: keyof typeof reasonFor, reason: string, eta: string, duration: number, buffer: number, latest: string, result: DepartureResult) {
  const plan = result.plan;
  if (s.terminal !== plan.terminal || s.destination!.trim().replace(/\s+/g, " ").toLowerCase() !== plan.ferry_destination.toLowerCase() || s.service_date !== plan.service_date || !s.allowed_service_kinds!.includes(plan.service_kind) || reason !== reasonFor[status]) return fail();
  if ((status === "MISSED" && buffer >= 0) || (status === "RISKY" && (buffer < 0 || buffer >= result.safety_buffer_min)) || (status === "SAFE" && buffer < result.safety_buffer_min)) return fail();
  const close = (a: number, b: number) => Math.abs(a - b) <= 2; // JS timestamp resolution is milliseconds.
  if (!close(Date.parse(eta), Date.parse(result.planned_departure_at) + duration * 60000) || !close(buffer * 60000, Date.parse(s.cutoff_at!) - Date.parse(eta)) || !close(Date.parse(latest), Date.parse(s.cutoff_at!) - (duration + result.safety_buffer_min) * 60000) || Date.parse(s.verified_at!) > Date.parse(result.calculated_at)) return fail();
}
export function parseDeparture(value: unknown): DepartureResult {
  const r = exact(value, "contract_version status reason_code reason plan planned_departure_at selected_schedule travel_time_min estimated_arrival_at buffer_min safety_buffer_min latest_departure_estimate_at route_estimate alternatives selection exclusions sources data_status assumptions warnings calculated_at disclaimer");
  const status = one(r.status, ["SAFE", "RISKY", "MISSED", "UNAVAILABLE"] as const), complete = status !== "UNAVAILABLE";
  const sel = exact(r.selection, "mode service_date examined_count excluded_count candidate_limit truncated"), sources = exact(r.sources, "schedule route congestion cutoff");
  const count = (v: unknown) => { const n = numeric(v, 0, 101); return Number.isInteger(n) ? n : fail(); };
  if (sel.candidate_limit !== 100 || r.contract_version !== "1.0") return fail();
  const alternatives = list<DepartureAlternative>(r.alternatives, 3, v => {
    const a = exact(v, "schedule status reason_code reason estimated_arrival_at travel_time_min buffer_min latest_departure_estimate_at");
    return { schedule: schedule(a.schedule, true), status: one(a.status, ["SAFE", "RISKY"] as const), reason_code: boundedText(a.reason_code), reason: boundedText(a.reason, 500), estimated_arrival_at: timestamp(a.estimated_arrival_at), travel_time_min: numeric(a.travel_time_min, 0, 1440), buffer_min: numeric(a.buffer_min), latest_departure_estimate_at: timestamp(a.latest_departure_estimate_at) };
  });
  const result: DepartureResult = {
    contract_version: "1.0", status, reason_code: boundedText(r.reason_code), reason: boundedText(r.reason, 500), plan: parseDeparturePlan(r.plan), planned_departure_at: timestamp(r.planned_departure_at), selected_schedule: nullable(r.selected_schedule, v => schedule(v, complete)), travel_time_min: nullable(r.travel_time_min, v => numeric(v, 0, 1440)), estimated_arrival_at: nullable(r.estimated_arrival_at, timestamp), buffer_min: nullable(r.buffer_min, numeric), safety_buffer_min: positive(r.safety_buffer_min), latest_departure_estimate_at: nullable(r.latest_departure_estimate_at, timestamp), route_estimate: nullable(r.route_estimate, route), alternatives,
    selection: { mode: one(sel.mode, ["selected", "automatic"] as const), service_date: calendarDate(sel.service_date), examined_count: count(sel.examined_count), excluded_count: count(sel.excluded_count), candidate_limit: 100, truncated: bool(sel.truncated) },
    exclusions: list(r.exclusions, 101, v => { const e = exact(v, "schedule_id reason_code"); return { schedule_id: nullable(e.schedule_id, uuid), reason_code: one(e.reason_code, [...unavailableCodes, "SCHEDULE_MISMATCH", "SERVICE_MISMATCH"]) }; }),
    sources: { schedule: nullable(sources.schedule, boundedText), route: nullable(sources.route, boundedText), congestion: nullable(sources.congestion, boundedText), cutoff: nullable(sources.cutoff, boundedText) }, data_status: one(r.data_status, ["simulation", "unavailable"] as const), assumptions: list(r.assumptions, 20, v => boundedText(v, 500)), warnings: list(r.warnings, 20, v => { const w = exact(v, "code message"); return { code: boundedText(w.code), message: boundedText(w.message, 500) }; }), calculated_at: timestamp(r.calculated_at), disclaimer: boundedText(r.disclaimer, 1000),
  };
  if (result.selection.excluded_count > result.selection.examined_count || result.selection.service_date !== result.plan.service_date || result.selection.mode !== (result.plan.schedule_id ? "selected" : "automatic") || result.planned_departure_at !== `${result.plan.departure_date}T${result.plan.departure_time}:00+07:00` || (result.plan.schedule_id && result.selected_schedule?.schedule_id !== result.plan.schedule_id)) return fail();
  if (result.route_estimate && Math.abs(Date.parse(result.route_estimate.estimated_arrival_at) - Date.parse(result.planned_departure_at) - result.route_estimate.final_time_min * 60000) > 2) return fail();
  if (!complete) {
    one(result.reason_code, unavailableCodes);
    if (result.data_status !== "unavailable" || [result.travel_time_min, result.estimated_arrival_at, result.buffer_min, result.latest_departure_estimate_at].some(v => v !== null) || alternatives.length) return fail();
  } else {
    if (!result.selected_schedule || result.travel_time_min === null || result.estimated_arrival_at === null || result.buffer_min === null || result.latest_departure_estimate_at === null || result.data_status !== "simulation" || !result.route_estimate || result.route_estimate.routing_source !== "OSRM API" || result.route_estimate.congestion_status !== "synthetic_estimate" || !result.route_estimate.context_verified || result.route_estimate.final_time_min !== result.travel_time_min || result.route_estimate.estimated_arrival_at !== result.estimated_arrival_at) return fail();
    if (result.sources.schedule !== result.selected_schedule.source || result.sources.cutoff !== result.selected_schedule.source || result.sources.route !== result.route_estimate.routing_source || result.sources.congestion !== result.route_estimate.congestion_status) return fail();
    if (result.selection.truncated && (result.selection.mode === "automatic" || alternatives.length)) return fail();
    verifyDecision(result.selected_schedule, status, result.reason_code, result.estimated_arrival_at, result.travel_time_min, result.buffer_min, result.latest_departure_estimate_at, result);
  }
  const ids = new Set([result.selected_schedule?.schedule_id]);
  for (const [i, a] of alternatives.entries()) {
    if (ids.has(a.schedule.schedule_id) || a.travel_time_min !== result.travel_time_min || a.estimated_arrival_at !== result.estimated_arrival_at) return fail();
    ids.add(a.schedule.schedule_id);
    if (i) { const prev = alternatives[i - 1].schedule; if (Date.parse(prev.departure_at!) > Date.parse(a.schedule.departure_at!) || (Date.parse(prev.departure_at!) === Date.parse(a.schedule.departure_at!) && prev.schedule_id! > a.schedule.schedule_id!)) return fail(); }
    verifyDecision(a.schedule, a.status, a.reason_code, a.estimated_arrival_at, a.travel_time_min, a.buffer_min, a.latest_departure_estimate_at, result);
  }
  return result;
}
export function samePlan(a: DeparturePlan, b: DeparturePlan): boolean {
  return Object.keys(a).every(k => k === "origin" ? a.origin.lat === b.origin.lat && a.origin.lng === b.origin.lng : a[k as keyof DeparturePlan] === b[k as keyof DeparturePlan]);
}
export function parseRecordedSailings(value: unknown): RecordedSailing[] {
  const data = record(value);
  if (!Array.isArray(data.schedules) || data.schedules.length > 10000) return fail();
  const rows: RecordedSailing[] = [], seen = new Set<string>();
  for (const value of data.schedules.slice(0, 100)) {
    try {
      const r = record(value), id = uuid(r.id ?? r.schedule_id), terminal = one(r.terminal, terminals);
      const groups = { batu_ampar: "TM001", batam_center: "TM002", sekupang: "TM003" };
      if ((r.terminal_id != null && r.terminal_id !== groups[terminal]) || seen.has(id)) continue;
      seen.add(id);
      const optionalText = (v: unknown) => v == null ? null : boundedText(v, 80);
      rows.push({ id, terminal, destination: boundedText(r.destination), cutoff: optionalText(r.source_cutoff_at ?? r.cutoff_time), departure: optionalText(r.source_departure_at ?? r.departure_time), serviceDate: r.service_date == null ? null : calendarDate(r.service_date), zone: optionalText(r.source_timezone), verified: optionalText(r.verified_at), synthetic: r.source === "synthetic_fixture" });
    } catch { /* Invalid catalog rows cannot become selectable sailings. */ }
  }
  return rows;
}
