export type TurnStatus = "in_progress" | "completed" | "failed" | "interrupted";

export type DataStatus = "synthetic_estimate" | "database" | "estimated" | "default_fallback" | "unknown";
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ResultMetadata = {
  title: string; source: string; data_status: DataStatus; disclaimer: string;
  observed_at?: string; calculated_at?: string;
};
export type CongestionData = {
  segment_id: string; day_type: "weekday" | "weekend"; hour: number;
  congestion_level: "LOW" | "MEDIUM" | "HIGH"; multiplier: number;
};
export type ScheduleEntry = {
  terminal: string; destination: string; departure_time: string;
  cutoff_time?: string; vessel_type?: string; cargo_capacity_tons?: number;
};
export type RouteData = {
  distance_km: number; final_time_min: number; routing_source: string;
  base_time_min?: number; congestion_level?: "LOW" | "MEDIUM" | "HIGH";
  congestion_multiplier?: number; emission_kg?: number; matched_segment_id?: string;
  latest_gate_in?: string; optimal_departure?: string;
};
export type OracleResult = ResultMetadata & (
  { type: "congestion"; data: CongestionData } |
  { type: "schedule"; data: { schedules: ScheduleEntry[] } } |
  { type: "route"; data: RouteData } |
  { type: "generic"; data: { [key: string]: JsonValue } }
);

export type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};
export type StoredMessage = {
  id: string;
  conversation_id: string;
  turn_id: string;
  sequence: number;
  role: "user" | "assistant" | "tool";
  content: string | null;
  status: TurnStatus;
  structured_results: OracleResult[];
  unavailable_results?: number;
  created_at: string;
};
export type ConversationPage = { conversations: Conversation[]; next_cursor: string | null };
export type MessagePage = { messages: StoredMessage[]; next_cursor: string | null };
export type DisplayMessage = {
  id: string;
  serverId?: string;
  role: "user" | "agent" | "status" | "error";
  content: string;
  outcome?: TurnStatus | "streaming" | "unknown";
  results?: OracleResult[];
  unavailableResults?: number;
};
export type PendingTurn = {
  message: string;
  requestId: string;
  conversationId?: string;
  userMessageId: string;
  agentMessageId: string;
  userServerId?: string;
  assistantServerId?: string;
  turnId?: string;
};
