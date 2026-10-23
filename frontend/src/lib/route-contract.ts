import type {
  RouteData,
  PlannerRouteData,
  RouteOption,
  RouteInput,
  RouteGeometry,
  LocationPoint,
} from "../types/route";
const levels = ["LOW", "MEDIUM", "HIGH"];
const clock = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const invalid = () => {
  throw new Error("The route data could not be validated.");
};
function object(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    return invalid();
  return value.trim();
}
function number(value: unknown, positive = false): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (positive ? value <= 0 : value < 0)
  )
    return invalid();
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
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return invalid();
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const days = new Date(0);
  days.setUTCFullYear(year, month, 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days.getUTCDate())
    return invalid();
  return value;
}
function optional<T>(
  value: unknown,
  validate: (value: unknown) => T,
): T | undefined {
  return value === null || value === undefined ? undefined : validate(value);
}
function coordinate(value: unknown, limit: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > limit
  )
    return invalid();
  return value;
}
function point(value: unknown): LocationPoint {
  const row = object(value);
  return { lat: coordinate(row.lat, 90), lng: coordinate(row.lng, 180) };
}
function geometry(value: unknown): RouteGeometry {
  const row = object(value);
  if (
    row.type !== "LineString" ||
    !Array.isArray(row.coordinates) ||
    row.coordinates.length < 2 ||
    row.coordinates.length > 160
  )
    return invalid();
  return {
    type: "LineString",
    coordinates: row.coordinates.map((value) => {
      if (!Array.isArray(value) || value.length !== 2) return invalid();
      return [coordinate(value[0], 180), coordinate(value[1], 90)];
    }),
  };
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T))
    return invalid();
  return value as T;
}
function calendarDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return invalid();
  timestamp(`${value}T00:00:00Z`);
  return value;
}
export function parseRoute(value: unknown): RouteData {
  const data = object(value);
  const route: RouteData = {
    distance_km: number(data.distance_km),
    final_time_min: number(data.final_time_min),
    routing_source: text(data.routing_source, 200),
  };
  const optionalFields = {
    base_time_min: optional(data.base_time_min, number),
    emission_kg: optional(data.emission_kg, number),
    congestion_level: optional(data.congestion_level, level),
    congestion_multiplier: optional(data.congestion_multiplier, (value) =>
      number(value, true),
    ),
    matched_segment_id: optional(data.matched_segment_id, (value) =>
      text(value, 80),
    ),
    matched_segment_name: optional(data.matched_segment_name, (value) =>
      text(value, 256),
    ),
    latest_gate_in: optional(data.latest_gate_in, time),
    optimal_departure: optional(data.optimal_departure, time),
    origin: optional(data.origin, point),
    destination: optional(data.destination, point),
    origin_name: optional(data.origin_name, (value) => text(value, 256)),
    destination_name: optional(data.destination_name, (value) =>
      text(value, 256),
    ),
    route_geometry: optional(data.route_geometry, geometry),
    departure_time: optional(data.departure_time, time),
    departure_date: optional(data.departure_date, calendarDate),
    planning_timezone: optional(data.planning_timezone, (value) =>
      choice(value, ["Asia/Jakarta"] as const),
    ),
    day_type: optional(data.day_type, (value) =>
      choice(value, ["weekday", "weekend"] as const),
    ),
    cargo_type: optional(data.cargo_type, (value) =>
      choice(value, ["CONTAINER", "FAST_FREIGHT"] as const),
    ),
    vessel_etd: optional(data.vessel_etd, (value) =>
      typeof value === "string" && value.includes("T")
        ? timestamp(value)
        : time(value),
    ),
    departure_datetime: optional(data.departure_datetime, timestamp),
    latest_gate_in_datetime: optional(data.latest_gate_in_datetime, timestamp),
    optimal_departure_datetime: optional(
      data.optimal_departure_datetime,
      timestamp,
    ),
    estimated_arrival_datetime: optional(
      data.estimated_arrival_datetime,
      timestamp,
    ),
    estimated_arrival_time: optional(data.estimated_arrival_time, time),
    cutoff_slack_min: optional(data.cutoff_slack_min, (value) =>
      typeof value === "number" && Number.isFinite(value) ? value : invalid(),
    ),
    calculation_time: optional(data.calculation_time, timestamp),
    departure_date_inferred: optional(data.departure_date_inferred, (value) =>
      typeof value === "boolean" ? value : invalid(),
    ),
    departure_feasible: optional(data.departure_feasible, (value) =>
      typeof value === "boolean" ? value : invalid(),
    ),
    planning_warning: optional(data.planning_warning, (value) =>
      text(value, 2000),
    ),
    congestion_status: optional(data.congestion_status, (value) =>
      choice(value, [
        "synthetic_estimate",
        "default_fallback",
        "unavailable",
      ] as const),
    ),
  };
  for (const [key, value] of Object.entries(optionalFields))
    if (value !== undefined) Object.assign(route, { [key]: value });
  return route;
}

function parseRouteOption(value: unknown): RouteOption {
  const row = object(value);
  const route_id = text(row.route_id, 20);
  const display_label = text(row.display_label, 40);
  if (!/^route-\d+$/.test(route_id)) return invalid();
  const parsed = parseRoute({
    ...row,
    route_options: undefined,
    default_route_id: undefined,
  });
  if (
    parsed.base_time_min === undefined ||
    parsed.emission_kg === undefined ||
    parsed.congestion_status === undefined ||
    parsed.route_geometry === undefined
  )
    return invalid();
  return {
    route_id,
    display_label,
    routing_source: parsed.routing_source,
    distance_km: parsed.distance_km,
    base_time_min: parsed.base_time_min,
    final_time_min: parsed.final_time_min,
    congestion_level: parsed.congestion_level,
    congestion_multiplier: parsed.congestion_multiplier,
    congestion_status: parsed.congestion_status,
    emission_kg: parsed.emission_kg,
    matched_segment_id: parsed.matched_segment_id,
    matched_segment_name: parsed.matched_segment_name,
    route_geometry: parsed.route_geometry,
    latest_gate_in: parsed.latest_gate_in,
    optimal_departure: parsed.optimal_departure,
    latest_gate_in_datetime: parsed.latest_gate_in_datetime,
    optimal_departure_datetime: parsed.optimal_departure_datetime,
    estimated_arrival_datetime: parsed.estimated_arrival_datetime,
    estimated_arrival_time: parsed.estimated_arrival_time,
    cutoff_slack_min: parsed.cutoff_slack_min,
    departure_feasible: parsed.departure_feasible,
    planning_warning: parsed.planning_warning,
  };
}

export function selectRouteOption(
  data: PlannerRouteData,
  routeId?: string,
): RouteData {
  const options = data.route_options || [];
  const selected =
    options.find((option) => option.route_id === routeId) ||
    options.find((option) => option.route_id === data.default_route_id);
  return selected ? { ...data, ...selected } : data;
}

export function parseRouteAlternatives(value: unknown): PlannerRouteData {
  const row = object(value);
  const route = parseRoute(row);
  const options = optional(row.route_options, (value) => {
    if (!Array.isArray(value)) return invalid();
    return value.map(parseRouteOption);
  }) || [];
  const defaultRouteId = optional(row.default_route_id, (value) => {
    const id = text(value, 20);
    if (!/^route-\d+$/.test(id)) return invalid();
    return id;
  });
  if (
    options.length &&
    (!defaultRouteId || !options.some((option) => option.route_id === defaultRouteId))
  )
    return invalid();
  return {
    ...route,
    route_options: options,
    default_route_id: defaultRouteId,
  };
}

export function parseRouteInput(value: unknown): RouteInput {
  const row = object(value);
  const areaPoint = (value: unknown) => {
    const p = point(value);
    if (p.lat < 0.7 || p.lat > 1.25 || p.lng < 103.8 || p.lng > 104.3)
      throw new Error(
        "Choose a supported Batam location or coordinates within Batam.",
      );
    return p;
  };
  const input: RouteInput = {
    origin: areaPoint(row.origin),
    destination: areaPoint(row.destination),
    time: time(row.time),
    day_type: choice(row.day_type, ["weekday", "weekend"] as const),
  };
  if (input.time.length !== 5)
    throw new Error("Departure time must use HH:MM WIB.");
  if (row.departure_date) {
    input.departure_date = calendarDate(row.departure_date);
    const weekday = new Date(`${input.departure_date}T00:00:00Z`).getUTCDay();
    if (
      (weekday === 0 || weekday === 6 ? "weekend" : "weekday") !==
      input.day_type
    )
      throw new Error("Departure date conflicts with day type.");
  }
  for (const key of ["origin_name", "destination_name"] as const)
    if (row[key]) input[key] = text(row[key], 256);
  if (Boolean(row.vessel_etd) !== Boolean(row.cargo_type))
    throw new Error(
      "Provide both cargo type and vessel ETD for a cutoff check.",
    );
  if (row.vessel_etd) {
    input.vessel_etd =
      typeof row.vessel_etd === "string" && row.vessel_etd.includes("T")
        ? timestamp(row.vessel_etd)
        : time(row.vessel_etd);
    input.cargo_type = choice(row.cargo_type, [
      "CONTAINER",
      "FAST_FREIGHT",
    ] as const);
    if (!input.vessel_etd.includes("T") && input.vessel_etd.length !== 5)
      throw new Error("Vessel ETD clock time must use HH:MM WIB.");
    if (!input.departure_date && input.vessel_etd.includes("T")) {
      const localDate = new Date(Date.parse(input.vessel_etd) + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
      const d = new Date(`${localDate}T00:00:00Z`).getUTCDay();
      if ((d === 0 || d === 6 ? "weekend" : "weekday") !== input.day_type)
        throw new Error(
          "Vessel local date conflicts with day type; provide your departure date.",
        );
    }
  }
  return input;
}
