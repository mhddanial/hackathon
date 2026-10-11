import { validUuid } from "./oracle-stream";
import { parseResults } from "./oracle-results";
import type { Conversation, ConversationPage, MessagePage, StoredMessage } from "../types/oracle";

type SessionResponse = {
  data: { session: { access_token: string; user: { id: string } } | null };
  error: unknown;
};
type Auth = {
  getSession: () => Promise<SessionResponse>;
  refreshSession: () => Promise<SessionResponse>;
};

export class OracleApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const unavailable = () => new OracleApiError(503, "Oracle is unavailable. Please retry.");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw unavailable();
  return value as Record<string, unknown>;
}
function date(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function cursor(value: unknown): string | null {
  if (value === null || (typeof value === "string" && value.length > 0 && value.length <= 512)) return value;
  throw unavailable();
}
function conversation(value: unknown): Conversation {
  const item = object(value);
  if (!validUuid(item.id) || !(item.title === null || (typeof item.title === "string" && item.title.length <= 160))
      || !date(item.created_at) || !date(item.updated_at) || !(item.archived_at === null || date(item.archived_at))) throw unavailable();
  return { id: item.id, title: item.title, created_at: item.created_at, updated_at: item.updated_at, archived_at: item.archived_at };
}
function message(value: unknown, conversationId: string): StoredMessage {
  const item = object(value);
  if (!validUuid(item.id) || item.conversation_id !== conversationId || !validUuid(item.turn_id)
      || !Number.isSafeInteger(item.sequence) || Number(item.sequence) < 1
      || typeof item.role !== "string" || !["user", "assistant", "tool"].includes(item.role)
      || typeof item.status !== "string" || !["in_progress", "completed", "failed", "interrupted"].includes(item.status)
      || !(item.content === null || (typeof item.content === "string" && item.content.length <= 32000))
      || !Array.isArray(item.structured_results) || item.structured_results.length > 12 || !date(item.created_at)) throw unavailable();
  const parsed = parseResults(item.structured_results);
  return { id: item.id, conversation_id: conversationId, turn_id: item.turn_id, sequence: Number(item.sequence),
    role: item.role as StoredMessage["role"], content: item.content, status: item.status as StoredMessage["status"],
    structured_results: parsed.results, unavailable_results: parsed.unavailable, created_at: item.created_at };
}

export function createOracleApi(userId: string, auth: Auth, baseUrl: string, fetcher: typeof fetch = fetch) {
  const requireId = (id: string) => { if (!validUuid(id)) throw new OracleApiError(422, "Invalid conversation ID."); return id; };
  async function token(refresh: boolean, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    let response: SessionResponse;
    try { response = await (refresh ? auth.refreshSession() : auth.getSession()); }
    catch { throw new OracleApiError(401, "Your session expired. Sign in again."); }
    signal.throwIfAborted();
    if (response.error || !response.data.session || response.data.session.user.id !== userId || !response.data.session.access_token) {
      throw new OracleApiError(401, "Your session expired. Sign in again.");
    }
    return response.data.session.access_token;
  }
  async function request(path: string, signal: AbortSignal, body?: object, method = "GET"): Promise<Response> {
    const serialized = body ? JSON.stringify(body) : undefined;
    // A 401 is rejected before the backend executes a mutation. Chat retry also
    // retains exactly the same request UUID/body. Network/5xx failures never auto-retry.
    for (let attempt = 0; attempt < 2; attempt++) {
      const accessToken = await token(attempt === 1, signal);
      let response: Response;
      try { response = await fetcher(`${baseUrl.replace(/\/$/, "")}${path}`, { method, signal,
        headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: serialized }); }
      catch (error) { signal.throwIfAborted(); throw error instanceof OracleApiError ? error : unavailable(); }
      signal.throwIfAborted();
      if (response.status === 401 && attempt === 0) { await response.body?.cancel(); continue; }
      if (!response.ok) {
        await response.body?.cancel();
        const text = response.status === 401 ? "Your session expired. Sign in again."
          : response.status === 404 ? "Conversation unavailable. It may no longer exist or belong to this account."
          : response.status === 409 ? "This conversation has an active or conflicting turn. Wait, then reload or retry."
          : response.status === 422 ? "The Oracle request is invalid." : "Oracle is unavailable. Please retry.";
        throw new OracleApiError(response.status, text);
      }
      return response;
    }
    throw unavailable();
  }
  async function json(path: string, signal: AbortSignal, body?: object, method?: string): Promise<unknown> {
    const response = await request(path, signal, body, method);
    try { const data: unknown = await response.json(); signal.throwIfAborted(); return data; }
    catch { signal.throwIfAborted(); throw unavailable(); }
  }
  return {
    async list(signal: AbortSignal, includeArchived = false, next?: string): Promise<ConversationPage> {
      const params = new URLSearchParams({ limit: "30", include_archived: String(includeArchived) });
      if (next) params.set("cursor", cursor(next)!);
      const page = object(await json(`/user/conversations?${params}`, signal));
      if (!Array.isArray(page.conversations) || page.conversations.length > 30) throw unavailable();
      return { conversations: page.conversations.map(conversation), next_cursor: cursor(page.next_cursor) };
    },
    async get(id: string, signal: AbortSignal): Promise<Conversation> {
      const item = conversation(await json(`/user/conversations/${requireId(id)}`, signal));
      if (item.id !== id) throw unavailable();
      return item;
    },
    async messages(id: string, signal: AbortSignal, next?: string): Promise<MessagePage> {
      const params = new URLSearchParams({ limit: "100" });
      if (next) params.set("cursor", cursor(next)!);
      const page = object(await json(`/user/conversations/${requireId(id)}/messages?${params}`, signal));
      if (!Array.isArray(page.messages) || page.messages.length > 100) throw unavailable();
      const messages = page.messages.map(item => message(item, id));
      if (messages.some((item, i) => i > 0 && item.sequence <= messages[i - 1].sequence)) throw unavailable();
      return { messages, next_cursor: cursor(page.next_cursor) };
    },
    async archive(id: string, archived: boolean, signal: AbortSignal): Promise<Conversation> {
      const item = conversation(await json(`/user/conversations/${requireId(id)}`, signal, { archived }, "PATCH"));
      if (item.id !== id) throw unavailable();
      return item;
    },
    async chat(message: string, requestId: string, conversationId: string | undefined, signal: AbortSignal): Promise<Response> {
      requireId(requestId);
      if (conversationId) requireId(conversationId);
      if (!message.trim() || message.length > 8000) throw new OracleApiError(422, "Message must contain 1–8,000 characters.");
      const response = await request("/agent/chat", signal, { message: message.trim(), client_request_id: requestId,
        ...(conversationId ? { conversation_id: conversationId } : {}) }, "POST");
      if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) { await response.body?.cancel(); throw unavailable(); }
      return response;
    },
  };
}
