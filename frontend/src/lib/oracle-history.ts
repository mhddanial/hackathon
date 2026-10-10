import type { DisplayMessage, PendingTurn, StoredMessage } from "../types/oracle";
import { validUuid } from "./oracle-stream";

export function selectedConversation(search: string): string | null {
  const values = new URLSearchParams(search).getAll("conversation");
  return values.length === 1 && validUuid(values[0]) ? values[0].toLowerCase() : null;
}

export function mergeMessages(previous: StoredMessage[], next: StoredMessage[]): StoredMessage[] {
  const rows = new Map(previous.map(row => [row.id, row]));
  for (const row of next) rows.set(row.id, row);
  return [...rows.values()].sort((a, b) => a.sequence - b.sequence);
}

export function restoreMessages(rows: StoredMessage[], pending?: PendingTurn, provisional: DisplayMessage[] = []) {
  const assistant = pending?.assistantServerId ? rows.find(row => row.id === pending.assistantServerId) : undefined;
  const unresolved = pending && (!assistant || assistant.status === "in_progress") ? pending : null;
  const messages: DisplayMessage[] = rows.filter(row => row.role !== "tool").map(row => {
    const localId = row.id === pending?.userServerId ? pending.userMessageId
      : row.id === pending?.assistantServerId ? pending.agentMessageId : row.id;
    const prior = provisional.find(item => item.id === localId);
    return { id: localId, serverId: row.id, role: row.role === "user" ? "user" : "agent",
      content: row.content ?? (row.status === "in_progress" ? prior?.content ?? "" : ""),
      outcome: row.status, results: row.structured_results };
  });
  if (unresolved) {
    for (const id of [unresolved.userMessageId, unresolved.agentMessageId]) {
      if (!messages.some(row => row.id === id)) {
        const prior = provisional.find(row => row.id === id);
        messages.push(prior ? { ...prior, outcome: id === unresolved.agentMessageId ? "unknown" : prior.outcome }
          : { id, role: id === unresolved.userMessageId ? "user" : "agent",
            content: id === unresolved.userMessageId ? unresolved.message : "", outcome: "unknown" });
      }
    }
  }
  return { messages, pending: unresolved };
}

export function hasRecentActiveTurn(rows: StoredMessage[], now = Date.now()) {
  return rows.some(row => row.role === "assistant" && row.status === "in_progress" && now - Date.parse(row.created_at) < 180000);
}
