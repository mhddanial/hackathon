export type OracleEvent = {
  type: "metadata" | "status" | "chunk" | "error" | "result" | "done";
  content?: string;
  conversation_id?: string;
  turn_id?: string;
  user_message_id?: string;
  assistant_message_id?: string;
  message_id?: string | null;
  results?: unknown[];
  outcome?: "completed" | "failed" | "interrupted";
  persisted?: boolean;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validUuid(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}

function parseFrame(frame: string): OracleEvent | null {
  const text = frame.split("\n").filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trimStart()).join("\n");
  if (!text) return null;
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object") throw new Error("Invalid Oracle event");
  const event = value as OracleEvent;
  if (["status", "chunk", "error"].includes(event.type) && typeof event.content === "string") return event;
  if (event.type === "metadata" && [event.conversation_id, event.turn_id, event.user_message_id, event.assistant_message_id].every(validUuid)) return event;
  if (event.type === "result" && Array.isArray(event.results) && event.results.length <= 12) return event;
  if (event.type === "done" && validUuid(event.conversation_id) && validUuid(event.turn_id)
      && ["completed", "failed", "interrupted"].includes(event.outcome ?? "") && typeof event.persisted === "boolean"
      && (event.outcome !== "completed" || (event.persisted && validUuid(event.message_id)))) return event;
  throw new Error("Invalid Oracle event");
}

export async function consumeOracleStream(body: ReadableStream<Uint8Array>, onEvent: (event: OracleEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const drain = () => {
    // Normalize CRLF only after decoding; a CR/LF pair can span read chunks.
    buffer = buffer.replace(/\r\n/g, "\n");
    let end = buffer.indexOf("\n\n");
    while (end !== -1) {
      if (end > 300000) throw new Error("Oracle event exceeded the limit");
      const event = parseFrame(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
      if (event) onEvent(event);
      end = buffer.indexOf("\n\n");
    }
    if (buffer.length > 300000) throw new Error("Oracle event exceeded the limit");
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      drain();
    }
    buffer += decoder.decode();
    drain();
    if (buffer.trim()) {
      const event = parseFrame(buffer);
      if (event) onEvent(event);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
