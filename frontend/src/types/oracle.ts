export type TurnStatus = "in_progress" | "completed" | "failed" | "interrupted";

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
  structured_results: unknown[];
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
  results?: unknown[];
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
