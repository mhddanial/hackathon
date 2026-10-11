"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Archive, ArchiveRestore, Send, Bot, Sparkles, RefreshCw, Square } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ConversationList } from "@/components/oracle/ConversationList";
import { OracleResults } from "@/components/oracle/OracleResults";
import { createClient } from "@/utils/supabase/client";
import { createOracleApi, OracleApiError } from "@/lib/oracle-api";
import { consumeOracleStream, validUuid } from "@/lib/oracle-stream";
import { selectedConversation, mergeMessages, restoreMessages, hasRecentActiveTurn } from "@/lib/oracle-history";
import type { Conversation, DisplayMessage, PendingTurn, StoredMessage } from "@/types/oracle";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
const greeting: DisplayMessage = { id: "oracle-greeting", role: "agent",
  content: "I can check project congestion estimates, recorded ferry schedules, or route estimates. How can I assist you?" };
const errorText = (error: unknown) => error instanceof OracleApiError ? error.message
  : error instanceof DOMException && error.name === "TimeoutError" ? "The request timed out. Please retry."
  : "The saved outcome is not confirmed. Retry this turn or reload messages.";
const boundedSignal = (controller: AbortController) => AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
function writeSelection(id: string | null, push = false) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("conversation", id); else url.searchParams.delete("conversation");
  if (url.href !== window.location.href) window.history[push ? "pushState" : "replaceState"](null, "", url);
}

export default function OracleChatPage() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Loading Oracle…</p>;
  if (!user) return <p>Sign in to view your Oracle conversations.</p>;
  return <OracleChat key={user.id} userId={user.id} />;
}

function OracleChat({ userId }: { userId: string }) {
  const api = useMemo(() => {
    const client = createClient();
    return createOracleApi(userId, { getSession: () => client.auth.getSession(), refreshSession: () => client.auth.refreshSession() }, API_URL);
  }, [userId]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listCursor, setListCursor] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [storedRows, setStoredRows] = useState<StoredMessage[]>([]);
  const [messages, setMessages] = useState<DisplayMessage[]>([greeting]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [retryTurn, setRetryTurn] = useState<PendingTurn | null>(null);
  const [mutating, setMutating] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingDraft, setPendingDraft] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamAbort = useRef<AbortController | null>(null);
  const historyAbort = useRef<AbortController | null>(null);
  const mutationAbort = useRef<AbortController | null>(null);
  const listAbort = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const filter = useRef(false);
  const rows = useRef<StoredMessage[]>([]);
  const cursor = useRef<string | null>(null);
  const view = useRef<{ id: string | null; pending: PendingTurn | null; messages: DisplayMessage[] }>({ id: null, pending: null, messages: [greeting] });
  // Retry state is transient, scoped to this signed-in component, never browser storage.
  const unfinished = useRef(new Map<string, { pending: PendingTurn; messages: DisplayMessage[] }>());

  const display = useCallback((next: DisplayMessage[] | ((old: DisplayMessage[]) => DisplayMessage[])) => {
    view.current.messages = typeof next === "function" ? next(view.current.messages) : next;
    setMessages(view.current.messages);
  }, []);
  const remember = useCallback(() => {
    const pending = view.current.pending;
    if (pending) unfinished.current.set(pending.conversationId ?? "draft", { pending,
      messages: view.current.messages.map(message => message.outcome === "streaming" ? { ...message, outcome: "unknown" } : message) });
    setPendingDraft(unfinished.current.has("draft"));
  }, []);
  const cancelView = useCallback(() => {
    streamAbort.current?.abort(); streamAbort.current = null;
    historyAbort.current?.abort(); historyAbort.current = null;
    mutationAbort.current?.abort(); mutationAbort.current = null;
    epoch.current++;
    setLoading(false); setMutating(false); setNotice("");
  }, []);

  const refreshList = useCallback(async (next?: string) => {
    if (next && listAbort.current) return;
    listAbort.current?.abort();
    const controller = new AbortController(); listAbort.current = controller;
    const include = filter.current;
    setListLoading(true); setListError("");
    if (!next) { setConversations([]); setListCursor(null); }
    try {
      const page = await api.list(boundedSignal(controller), include, next);
      if (listAbort.current !== controller || controller.signal.aborted) return;
      if (next && page.next_cursor === next) throw new OracleApiError(503, "History pagination could not continue. Reload conversations.");
      setConversations(old => next ? [...new Map([...old, ...page.conversations].map(item => [item.id, item])).values()] : page.conversations);
      setListCursor(page.next_cursor);
      const current = page.conversations.find(item => item.id === view.current.id);
      if (current) setSelected(current);
    } catch (error) {
      if (listAbort.current === controller && !controller.signal.aborted) setListError(errorText(error));
    } finally {
      if (listAbort.current === controller) { listAbort.current = null; setListLoading(false); }
    }
  }, [api]);

  const openConversation = useCallback(async (id: string | null, push = true) => {
    if (id && !validUuid(id)) return;
    remember(); cancelView();
    const currentEpoch = epoch.current;
    const cached = id ? unfinished.current.get(id) : undefined;
    view.current = { id, pending: cached?.pending ?? null, messages: [] };
    rows.current = []; setStoredRows([]); cursor.current = null;
    setSelected(null); setSelectedId(id); setInput(""); setRetryTurn(null); setMessageCursor(null); setHistoryError("");
    writeSelection(id, push);
    if (!id) { display([greeting]); setHistoryLoading(false); return; }
    display([]); setHistoryLoading(true);
    const controller = new AbortController(); historyAbort.current = controller;
    try {
      const signal = boundedSignal(controller);
      const [conversation, page] = await Promise.all([api.get(id, signal), api.messages(id, signal)]);
      if (epoch.current !== currentEpoch || controller.signal.aborted) return;
      rows.current = page.messages; setStoredRows(page.messages); cursor.current = page.next_cursor;
      const restored = restoreMessages(page.messages, cached?.pending, cached?.messages);
      view.current.pending = restored.pending;
      if (!restored.pending) unfinished.current.delete(id);
      setSelected(conversation); setMessageCursor(page.next_cursor); setRetryTurn(restored.pending);
      display(restored.messages.length ? restored.messages : [greeting]);
    } catch (error) {
      if (epoch.current !== currentEpoch || controller.signal.aborted) return;
      setHistoryError(errorText(error));
      if (error instanceof OracleApiError && error.status === 404) {
        unfinished.current.delete(id); view.current.id = null; view.current.pending = null; setSelectedId(null); writeSelection(null);
      }
    } finally {
      if (epoch.current === currentEpoch) { historyAbort.current = null; setHistoryLoading(false); }
    }
  }, [api, cancelView, display, remember]);

  const disposeRequests = useCallback(() => {
    epoch.current++;
    streamAbort.current?.abort(); historyAbort.current?.abort(); mutationAbort.current?.abort(); listAbort.current?.abort();
    unfinished.current.clear();
  }, []);
  useEffect(() => {
    let alive = true;
    const restore = () => { void openConversation(selectedConversation(window.location.search), false); };
    queueMicrotask(() => { if (alive) { restore(); void refreshList(); } });
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      alive = false;
      disposeRequests();
    };
  }, [openConversation, refreshList, disposeRequests]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const loadMoreMessages = async () => {
    const id = view.current.id, next = cursor.current;
    if (!id || !next || historyAbort.current || streamAbort.current) return;
    const currentEpoch = epoch.current;
    const controller = new AbortController(); historyAbort.current = controller;
    setHistoryLoading(true); setHistoryError("");
    try {
      const page = await api.messages(id, boundedSignal(controller), next);
      if (epoch.current !== currentEpoch || controller.signal.aborted) return;
      if (page.next_cursor === next) throw new OracleApiError(503, "Messages could not continue. Reload this conversation.");
      rows.current = mergeMessages(rows.current, page.messages); setStoredRows(rows.current); cursor.current = page.next_cursor;
      const restored = restoreMessages(rows.current, view.current.pending ?? undefined, view.current.messages);
      view.current.pending = restored.pending;
      if (!restored.pending) unfinished.current.delete(id);
      setMessageCursor(page.next_cursor); setRetryTurn(restored.pending); display(restored.messages);
    } catch (error) {
      if (epoch.current === currentEpoch && !controller.signal.aborted) setHistoryError(errorText(error));
    } finally {
      if (epoch.current === currentEpoch) { historyAbort.current = null; setHistoryLoading(false); }
    }
  };

  const handleSend = async (text: string, retry?: PendingTurn) => {
    if (streamAbort.current || historyAbort.current || mutationAbort.current || historyError || cursor.current || selected?.archived_at
        || !text.trim() || text.trim().length > 8000 || (!retry && (view.current.pending || hasRecentActiveTurn(rows.current)))) return;
    const pending = retry ?? { message: text.trim(), requestId: crypto.randomUUID(), conversationId: view.current.id ?? undefined,
      userMessageId: crypto.randomUUID(), agentMessageId: crypto.randomUUID() };
    const currentEpoch = epoch.current;
    const controller = new AbortController(); streamAbort.current = controller;
    const current = () => epoch.current === currentEpoch && streamAbort.current === controller && !controller.signal.aborted;
    view.current.pending = pending; setRetryTurn(null); setNotice(""); setLoading(true); setInput("");
    if (retry) display(old => old.map(message => message.id === pending.agentMessageId ? { ...message, content: "", results: [], unavailableResults: 0, outcome: "streaming" } : message));
    else display(old => [...old.filter(item => item.id !== greeting.id),
      { id: pending.userMessageId, role: "user", content: pending.message },
      { id: pending.agentMessageId, role: "agent", content: "", outcome: "streaming" }]);
    remember();
    let receivedDone = false, receivedMetadata = false;
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await api.chat(pending.message, pending.requestId, pending.conversationId, controller.signal);
      await consumeOracleStream(response.body!, event => {
        if (!current()) return;
        if (receivedDone) throw new Error("Data after terminal event");
        if (event.type === "metadata") {
          if (receivedMetadata || (pending.conversationId && pending.conversationId !== event.conversation_id)
              || (pending.turnId && pending.turnId !== event.turn_id)) throw new Error("Mismatched turn metadata");
          receivedMetadata = true;
          if (unfinished.current.get("draft")?.pending === pending) unfinished.current.delete("draft");
          pending.conversationId = event.conversation_id; pending.turnId = event.turn_id;
          pending.userServerId = event.user_message_id; pending.assistantServerId = event.assistant_message_id;
          view.current.id = event.conversation_id!; setSelectedId(view.current.id); writeSelection(view.current.id);
          display(old => old.map(message => message.id === pending.userMessageId ? { ...message, serverId: pending.userServerId }
            : message.id === pending.agentMessageId ? { ...message, serverId: pending.assistantServerId } : message));
          remember(); void refreshList();
        } else if (!receivedMetadata) throw new Error("Missing turn metadata");
        else if (event.type === "chunk") display(old => old.map(message => message.id === pending.agentMessageId ? { ...message, content: message.content + event.content } : message));
        else if (event.type === "status" || event.type === "error") display(old => [...old, { id: crypto.randomUUID(), role: event.type as "status" | "error", content: event.content ?? "" }]);
        else if (event.type === "result") display(old => old.map(message => message.id === pending.agentMessageId ? { ...message, results: event.results, unavailableResults: event.unavailable_results ?? 0 } : message));
        else if (event.type === "done") {
          if (event.turn_id !== pending.turnId || event.conversation_id !== pending.conversationId
              || (event.persisted && event.message_id !== pending.assistantServerId)) throw new Error("Mismatched saved outcome");
          receivedDone = true;
          display(old => old.map(message => message.id === pending.agentMessageId ? { ...message, outcome: event.persisted ? event.outcome : "unknown" } : message));
          if (event.persisted) {
            rows.current = rows.current.map(row => row.turn_id === pending.turnId && row.role !== "tool" ? { ...row, status: event.outcome! } : row);
            setStoredRows(rows.current);
            view.current.pending = null; unfinished.current.delete(pending.conversationId!);
          }
          else { remember(); setRetryTurn(pending); }
        }
      });
      if (current() && !receivedDone) throw new Error("Stream ended without confirmation");
    } catch (error) {
      if (epoch.current === currentEpoch && streamAbort.current === controller) {
        setNotice(controller.signal.aborted ? "Response stopped. Its saved outcome is not confirmed; retry or reload messages." : errorText(error));
        if (view.current.pending) {
          const rejected = error instanceof OracleApiError && [401, 404, 422].includes(error.status);
          display(old => old.map(message => message.id === pending.agentMessageId ? { ...message, outcome: rejected ? "failed" : "unknown" } : message));
          if (rejected) { view.current.pending = null; unfinished.current.delete(pending.conversationId ?? "draft"); }
          else { remember(); setRetryTurn(pending); }
        }
      }
    } finally {
      clearTimeout(timeout);
      if (epoch.current === currentEpoch && streamAbort.current === controller) {
        streamAbort.current = null; setLoading(false); setPendingDraft(unfinished.current.has("draft")); void refreshList();
      }
    }
  };

  const archiveConversation = async () => {
    if (!selected || streamAbort.current || historyAbort.current || mutationAbort.current || view.current.pending || hasRecentActiveTurn(rows.current)) return;
    const currentEpoch = epoch.current, id = selected.id;
    const controller = new AbortController(); mutationAbort.current = controller;
    setMutating(true); setNotice("");
    try {
      const conversation = await api.archive(id, !selected.archived_at, boundedSignal(controller));
      if (epoch.current !== currentEpoch || controller.signal.aborted) return;
      setSelected(conversation); void refreshList();
    } catch (error) { if (epoch.current === currentEpoch && !controller.signal.aborted) setNotice(errorText(error)); }
    finally { if (epoch.current === currentEpoch) { mutationAbort.current = null; setMutating(false); } }
  };
  const resumeDraft = () => {
    const cached = unfinished.current.get("draft");
    if (!cached) return;
    remember(); cancelView(); rows.current = []; setStoredRows([]); cursor.current = null;
    view.current = { id: null, pending: cached.pending, messages: cached.messages };
    setSelected(null); setSelectedId(null); setMessageCursor(null); setHistoryLoading(false); setHistoryError(""); setInput("");
    display(cached.messages); setRetryTurn(cached.pending); writeSelection(null, true);
  };
  const recentActive = hasRecentActiveTurn(storedRows);
  const blocked = loading || historyLoading || mutating || !!historyError || !!messageCursor || !!retryTurn || recentActive || !!selected?.archived_at;

  return <div className="flex min-w-0 flex-col gap-4 lg:h-[calc(100svh-var(--header-height)-var(--dashboard-inset)-var(--dashboard-padding)-var(--dashboard-padding))] lg:min-h-[36rem]">
    <header className="shrink-0"><h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground"><Sparkles className="w-6 h-6 text-primary" />Logistic Oracle</h1>
      <p className="text-sm text-[#5E6470]">Your saved logistics conversations</p></header>
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-4">
      <ConversationList items={conversations} selected={selectedId} loading={listLoading} error={listError} includeArchived={includeArchived}
        more={!!listCursor} pendingDraft={pendingDraft} onNew={() => { void openConversation(null); }} onSelect={id => { void openConversation(id); }}
        onReload={() => { void refreshList(); }} onMore={() => { void refreshList(listCursor ?? undefined); }} onResume={resumeDraft}
        onArchived={include => { filter.current = include; setIncludeArchived(include); void refreshList(); }} />
      <Card className="flex-1 min-w-0 min-h-[28rem] lg:min-h-0 flex flex-col gap-0 py-0 rounded-2xl bg-white overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold">{selected?.title || (selectedId ? "Untitled conversation" : "New conversation")}{selected?.archived_at ? " · Archived" : ""}</h2>
          <div className="flex gap-1 shrink-0">{selectedId && <Button variant="ghost" size="icon" aria-label="Reload messages" disabled={loading || historyLoading || mutating}
            onClick={() => { void openConversation(view.current.id, false); }}><RefreshCw className="w-4 h-4" /></Button>}
            {selected && <Button variant="outline" disabled={loading || historyLoading || mutating || !!retryTurn || recentActive} onClick={() => { void archiveConversation(); }}>
              {selected.archived_at ? <ArchiveRestore className="w-4 h-4 mr-1" /> : <Archive className="w-4 h-4 mr-1" />}{selected.archived_at ? "Restore" : "Archive"}</Button>}</div>
        </div>
        <div ref={scrollRef} role="log" aria-label="Conversation messages" aria-live="polite" className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 bg-[#F8F9FB]/50">
          {historyError && <div role="alert" className="text-sm text-red-700">{historyError}<Button variant="ghost" onClick={() => { void openConversation(view.current.id, false); }}>Retry messages</Button></div>}
          {messages.map(message => <div key={message.id} data-message-id={message.serverId} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "agent" && <Bot className="w-5 h-5 text-blue-600 shrink-0 mt-3" />}
            <div className={`rounded-xl p-3 max-w-[90%] md:max-w-[80%] text-sm whitespace-pre-wrap break-words ${message.role === "user" ? "bg-blue-600 text-white" : message.role === "error" ? "bg-red-50 text-red-700" : message.role === "status" ? "text-[#5E6470] italic text-xs" : "bg-white border border-[#E2E8F0] text-[#1A1D27]"}`}>
              {message.content || (message.outcome === "in_progress" || message.outcome === "streaming" ? "The answer has not been saved yet." : "No answer text was saved for this turn.")}
              {message.role === "agent" && message.outcome && message.outcome !== "completed" && <p className="mt-2 text-xs text-[#5E6470]">
                {message.outcome === "streaming" ? "Provisional response…" : message.outcome === "in_progress" ? "Turn in progress. Reload to check its outcome."
                  : message.outcome === "unknown" ? "Saved outcome not confirmed." : `This turn ${message.outcome === "interrupted" ? "was interrupted" : "failed"}.`}</p>}
              {message.role === "agent" && <OracleResults results={message.results} unavailable={message.unavailableResults} outcome={message.outcome} />}
            </div>
          </div>)}
          {historyLoading && <p role="status" className="text-sm text-[#5E6470]">Loading messages…</p>}
          {messageCursor && <div className="text-sm text-[#5E6470]">More saved messages are available. Load them before sending a follow-up.
            <Button variant="outline" className="ml-2" disabled={historyLoading} onClick={() => { void loadMoreMessages(); }}>Load more messages</Button></div>}
        </div>
        <div className="p-4 border-t border-[#E2E8F0] space-y-3">
          {notice && <p role="alert" className="text-sm text-red-700">{notice}</p>}
          {selected?.archived_at && <p className="text-sm text-[#5E6470]">This conversation is archived. Restore it to send a follow-up.</p>}
          {recentActive && !loading && !retryTurn && <p className="text-sm text-[#5E6470]">An earlier turn is still active. Reload messages to check it; stale turns can recover after three minutes.</p>}
          {retryTurn && !loading && <Button variant="outline" disabled={historyLoading || !!messageCursor || !!selected?.archived_at} onClick={() => { void handleSend(retryTurn.message, retryTurn); }}>Retry this turn</Button>}
          {loading && <div className="flex items-center justify-between"><p role="status" className="text-sm text-[#5E6470]">Oracle is responding…</p>
            <Button variant="outline" onClick={() => streamAbort.current?.abort()}><Square className="w-3 h-3 mr-2" />Stop response</Button></div>}
          {!selectedId && !retryTurn && !loading && <div className="flex flex-wrap gap-2">
            {["Estimate SEG001 congestion on a weekday at 08:00.", "Show recorded ferry departures from Batu Ampar."].map(text => <button key={text} disabled={blocked} onClick={() => setInput(text)} className="text-xs rounded-full border px-3 py-2 hover:bg-slate-50">{text}</button>)}
          </div>}
          <form onSubmit={event => { event.preventDefault(); if (!blocked) void handleSend(input); }} className="border border-[#E2E8F0] rounded-xl flex items-center p-2 gap-2 focus-within:ring-2 focus-within:ring-blue-200">
            <input aria-label="Message Oracle" type="text" maxLength={8000} disabled={blocked} value={input} onChange={event => setInput(event.target.value)}
              placeholder="Ask about congestion, routes, or schedules…" className="flex-1 min-w-0 bg-transparent outline-none text-sm px-2 disabled:opacity-60" />
            <Button type="submit" size="icon" aria-label="Send message" disabled={blocked || !input.trim()}><Send className="w-4 h-4" /></Button>
          </form>
          <p className="text-xs text-[#5E6470]">New conversation keeps saved history. Estimates and recorded data may have unknown freshness.</p>
        </div>
      </Card>
    </div>
  </div>;
}
