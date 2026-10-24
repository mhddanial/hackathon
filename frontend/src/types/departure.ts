export type Terminal = "batu_ampar" | "batam_center" | "sekupang";
export type ServiceKind = "cargo" | "passenger_hand_carry";
export type DepartureStatus = "SAFE" | "RISKY" | "MISSED" | "UNAVAILABLE";
export type DeparturePlan = {
  origin: { lat: number; lng: number };
  origin_name: string | null;
  terminal: Terminal;
  ferry_destination: string;
  departure_date: string;
  departure_time: string;
  service_date: string;
  service_kind: ServiceKind;
  day_type: "weekday" | "weekend";
  schedule_id: string | null;
};
export type ScheduleView = {
  schedule_id: string | null;
  occurrence_id: string | null;
  terminal: Terminal | null;
  destination: string | null;
  service_date: string | null;
  allowed_service_kinds: ServiceKind[] | null;
  source_timezone: string | null;
  source_departure_at: string | null;
  source_cutoff_at: string | null;
  departure_at: string | null;
  cutoff_at: string | null;
  verified_at: string | null;
  source: "database" | "synthetic_fixture" | null;
};
export type RouteEstimate = {
  final_time_min: number;
  routing_source: string;
  congestion_status: "synthetic_estimate" | "default_fallback" | "unavailable" | null;
  context_verified: boolean;
  estimated_arrival_at: string;
};
export type DepartureAlternative = {
  schedule: ScheduleView;
  status: "SAFE" | "RISKY";
  reason_code: string;
  reason: string;
  estimated_arrival_at: string;
  travel_time_min: number;
  buffer_min: number;
  latest_departure_estimate_at: string;
};
export type DepartureResult = {
  contract_version: "1.0";
  status: DepartureStatus;
  reason_code: string;
  reason: string;
  plan: DeparturePlan;
  planned_departure_at: string;
  selected_schedule: ScheduleView | null;
  travel_time_min: number | null;
  estimated_arrival_at: string | null;
  buffer_min: number | null;
  safety_buffer_min: number;
  latest_departure_estimate_at: string | null;
  route_estimate: RouteEstimate | null;
  alternatives: DepartureAlternative[];
  selection: { mode: "selected" | "automatic"; service_date: string; examined_count: number; excluded_count: number; candidate_limit: 100; truncated: boolean };
  exclusions: { schedule_id: string | null; reason_code: string }[];
  sources: { schedule: string | null; route: string | null; congestion: string | null; cutoff: string | null };
  data_status: "simulation" | "unavailable";
  assumptions: string[];
  warnings: { code: string; message: string }[];
  calculated_at: string;
  disclaimer: string;
};
// Raw catalog identity is useful even when occurrence metadata is unverified.
export type RecordedSailing = {
  id: string; terminal: Terminal; destination: string;
  cutoff: string | null; departure: string | null; serviceDate: string | null;
  zone: string | null; verified: string | null; synthetic: boolean;
};
