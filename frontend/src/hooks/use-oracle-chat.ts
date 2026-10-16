"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { createOracleApi, OracleApiError } from "@/lib/oracle-api";
import { consumeOracleStream, validUuid } from "@/lib/oracle-stream";
import {
  selectedConversation,
  mergeMessages,
  restoreMessages,
  hasRecentActiveTurn,
} from "@/lib/oracle-history";
import type {
  Conversation,
  DisplayMessage,
  PendingTurn,
  StoredMessage,
} from "@/types/oracle";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
const REQUEST_TIMEOUT_MS = 30_000;
const STREAM_TIMEOUT_MS = 120_000;
export const MAX_MESSAGE_LENGTH = 8000;

const greeting: DisplayMessage = {
  id: "oracle-greeting",
  role: "agent",
  content:
    "I can check project congestion estimates, recorded ferry schedules, or route estimates. How can I assist you?",
};

function errorText(error: unknown): string {
  if (error instanceof OracleApiError) {
    return error.message;
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "The request timed out. Please retry.";
  }
  return "The saved outcome is not confirmed. Retry this turn or reload messages.";
}

function boundedSignal(controller: AbortController): AbortSignal {
  return AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  ]);
}

function writeSelection(id: string | null, push = false) {
  const url = new URL(window.location.href);

  if (id) {
    url.searchParams.set("conversation", id);
  } else {
    url.searchParams.delete("conversation");
  }

  if (url.href !== window.location.href) {
    window.history[push ? "pushState" : "replaceState"](null, "", url);
  }
}

export function useOracleChat(userId: string) {
  const api = useMemo(() => {
    const client = createClient();
    return createOracleApi(
      userId,
      {
        getSession: () => client.auth.getSession(),
        refreshSession: () => client.auth.refreshSession(),
      },
      API_URL,
    );
  }, [userId]);

  // ---- State ---------------------------------------------------------------
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
  const [progress, setProgress] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [retryTurn, setRetryTurn] = useState<PendingTurn | null>(null);
  const [mutating, setMutating] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingDraft, setPendingDraft] = useState(false);

  // ---- Refs ----------------------------------------------------------------
  const streamAbort = useRef<AbortController | null>(null);
  const historyAbort = useRef<AbortController | null>(null);
  const mutationAbort = useRef<AbortController | null>(null);
  const listAbort = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const filter = useRef(false);
  const rows = useRef<StoredMessage[]>([]);
  const cursor = useRef<string | null>(null);
  const view = useRef<{
    id: string | null;
    pending: PendingTurn | null;
    messages: DisplayMessage[];
  }>({
    id: null,
    pending: null,
    messages: [greeting],
  });
  // Retry state is transient, scoped to this signed-in component, never browser storage.
  const unfinished = useRef(
    new Map<string, { pending: PendingTurn; messages: DisplayMessage[] }>(),
  );

  // ---- View helpers --------------------------------------------------------
  const display = useCallback(
    (
      next: DisplayMessage[] | ((old: DisplayMessage[]) => DisplayMessage[]),
    ) => {
      view.current.messages =
        typeof next === "function" ? next(view.current.messages) : next;
      setMessages(view.current.messages);
    },
    [],
  );

  const remember = useCallback(() => {
    const pending = view.current.pending;

    if (pending) {
      unfinished.current.set(pending.conversationId ?? "draft", {
        pending,
        messages: view.current.messages.map((message) =>
          message.outcome === "streaming"
            ? { ...message, outcome: "unknown" }
            : message,
        ),
      });
    }

    setPendingDraft(unfinished.current.has("draft"));
  }, []);

  const cancelView = useCallback(() => {
    streamAbort.current?.abort();
    streamAbort.current = null;
    historyAbort.current?.abort();
    historyAbort.current = null;
    mutationAbort.current?.abort();
    mutationAbort.current = null;
    epoch.current++;

    setLoading(false);
    setProgress("");
    setMutating(false);
    setNotice("");
  }, []);

  // ---- Conversation list ---------------------------------------------------
  const refreshList = useCallback(
    async (next?: string) => {
      if (next && listAbort.current) {
        return;
      }

      listAbort.current?.abort();
      const controller = new AbortController();
      listAbort.current = controller;
      const include = filter.current;

      setListLoading(true);
      setListError("");
      if (!next) {
        setConversations([]);
        setListCursor(null);
      }

      try {
        const page = await api.list(boundedSignal(controller), include, next);

        if (listAbort.current !== controller || controller.signal.aborted) {
          return;
        }
        if (next && page.next_cursor === next) {
          throw new OracleApiError(
            503,
            "History pagination could not continue. Reload conversations.",
          );
        }

        setConversations((old) =>
          next
            ? [
                ...new Map(
                  [...old, ...page.conversations].map((item) => [
                    item.id,
                    item,
                  ]),
                ).values(),
              ]
            : page.conversations,
        );
        setListCursor(page.next_cursor);

        const current = page.conversations.find(
          (item) => item.id === view.current.id,
        );
        if (current) {
          setSelected(current);
        }
      } catch (error) {
        if (listAbort.current === controller && !controller.signal.aborted) {
          setListError(errorText(error));
        }
      } finally {
        if (listAbort.current === controller) {
          listAbort.current = null;
          setListLoading(false);
        }
      }
    },
    [api],
  );

  // ---- Open conversation ---------------------------------------------------
  const openConversation = useCallback(
    async (id: string | null, push = true) => {
      if (id && !validUuid(id)) {
        return;
      }

      remember();
      cancelView();

      const currentEpoch = epoch.current;
      const cached = id ? unfinished.current.get(id) : undefined;

      view.current = { id, pending: cached?.pending ?? null, messages: [] };
      rows.current = [];
      cursor.current = null;
      setStoredRows([]);
      setSelected(null);
      setSelectedId(id);
      setInput("");
      setRetryTurn(null);
      setMessageCursor(null);
      setHistoryError("");
      writeSelection(id, push);

      if (!id) {
        display([greeting]);
        setHistoryLoading(false);
        return;
      }

      display([]);
      setHistoryLoading(true);

      const controller = new AbortController();
      historyAbort.current = controller;

      try {
        const signal = boundedSignal(controller);
        const [conversation, page] = await Promise.all([
          api.get(id, signal),
          api.messages(id, signal),
        ]);

        if (epoch.current !== currentEpoch || controller.signal.aborted) {
          return;
        }

        rows.current = page.messages;
        cursor.current = page.next_cursor;
        setStoredRows(page.messages);

        const restored = restoreMessages(
          page.messages,
          cached?.pending,
          cached?.messages,
        );
        view.current.pending = restored.pending;
        if (!restored.pending) {
          unfinished.current.delete(id);
        }

        setSelected(conversation);
        setMessageCursor(page.next_cursor);
        setRetryTurn(restored.pending);
        display(restored.messages.length ? restored.messages : [greeting]);
      } catch (error) {
        if (epoch.current !== currentEpoch || controller.signal.aborted) {
          return;
        }

        setHistoryError(errorText(error));

        if (error instanceof OracleApiError && error.status === 404) {
          unfinished.current.delete(id);
          view.current.id = null;
          view.current.pending = null;
          setSelectedId(null);
          writeSelection(null);
        }
      } finally {
        if (epoch.current === currentEpoch) {
          historyAbort.current = null;
          setHistoryLoading(false);
        }
      }
    },
    [api, cancelView, display, remember],
  );

  // ---- Lifecycle -----------------------------------------------------------
  const disposeRequests = useCallback(() => {
    epoch.current++;
    streamAbort.current?.abort();
    historyAbort.current?.abort();
    mutationAbort.current?.abort();
    listAbort.current?.abort();
    unfinished.current.clear();
  }, []);

  useEffect(() => {
    let alive = true;

    const restore = () => {
      void openConversation(
        selectedConversation(window.location.search),
        false,
      );
    };

    queueMicrotask(() => {
      if (alive) {
        restore();
        void refreshList();
      }
    });
    window.addEventListener("popstate", restore);

    return () => {
      window.removeEventListener("popstate", restore);
      alive = false;
      disposeRequests();
    };
  }, [openConversation, refreshList, disposeRequests]);

  // ---- Pagination ----------------------------------------------------------
  const loadMoreMessages = async () => {
    const id = view.current.id;
    const next = cursor.current;

    if (!id || !next || historyAbort.current || streamAbort.current) {
      return;
    }

    const currentEpoch = epoch.current;
    const controller = new AbortController();
    historyAbort.current = controller;

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const page = await api.messages(id, boundedSignal(controller), next);

      if (epoch.current !== currentEpoch || controller.signal.aborted) {
        return;
      }
      if (page.next_cursor === next) {
        throw new OracleApiError(
          503,
          "Messages could not continue. Reload this conversation.",
        );
      }

      rows.current = mergeMessages(rows.current, page.messages);
      cursor.current = page.next_cursor;
      setStoredRows(rows.current);

      const restored = restoreMessages(
        rows.current,
        view.current.pending ?? undefined,
        view.current.messages,
      );
      view.current.pending = restored.pending;
      if (!restored.pending) {
        unfinished.current.delete(id);
      }

      setMessageCursor(page.next_cursor);
      setRetryTurn(restored.pending);
      display(restored.messages);
    } catch (error) {
      if (epoch.current === currentEpoch && !controller.signal.aborted) {
        setHistoryError(errorText(error));
      }
    } finally {
      if (epoch.current === currentEpoch) {
        historyAbort.current = null;
        setHistoryLoading(false);
      }
    }
  };

  // ---- Send / retry --------------------------------------------------------
  const handleSend = async (text: string, retry?: PendingTurn) => {
    const trimmed = text.trim();
    const hasRequestInFlight =
      streamAbort.current || historyAbort.current || mutationAbort.current;
    const hasActiveTurn =
      !retry && (view.current.pending || hasRecentActiveTurn(rows.current));
    const isInvalidText = !trimmed || trimmed.length > MAX_MESSAGE_LENGTH;

    if (
      hasRequestInFlight ||
      historyError ||
      cursor.current ||
      selected?.archived_at ||
      isInvalidText ||
      hasActiveTurn
    ) {
      return;
    }

    const pending: PendingTurn = retry ?? {
      message: trimmed,
      requestId: crypto.randomUUID(),
      conversationId: view.current.id ?? undefined,
      userMessageId: crypto.randomUUID(),
      agentMessageId: crypto.randomUUID(),
    };

    const currentEpoch = epoch.current;
    const controller = new AbortController();
    streamAbort.current = controller;

    const isCurrent = () =>
      epoch.current === currentEpoch &&
      streamAbort.current === controller &&
      !controller.signal.aborted;

    const updateAgentMessage = (
      patch: (message: DisplayMessage) => DisplayMessage,
    ) =>
      display((old) =>
        old.map((message) =>
          message.id === pending.agentMessageId ? patch(message) : message,
        ),
      );

    view.current.pending = pending;
    setRetryTurn(null);
    setNotice("");
    setLoading(true);
    setProgress("");
    setInput("");

    if (retry) {
      updateAgentMessage((message) => ({
        ...message,
        content: "",
        results: [],
        unavailableResults: 0,
        outcome: "streaming",
      }));
    } else {
      display((old) => [
        ...old.filter((item) => item.id !== greeting.id),
        { id: pending.userMessageId, role: "user", content: pending.message },
        {
          id: pending.agentMessageId,
          role: "agent",
          content: "",
          outcome: "streaming",
        },
      ]);
    }
    remember();

    let receivedDone = false;
    let receivedMetadata = false;
    const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const response = await api.chat(
        pending.message,
        pending.requestId,
        pending.conversationId,
        controller.signal,
      );

      await consumeOracleStream(response.body!, (event) => {
        if (!isCurrent()) {
          return;
        }
        if (receivedDone) {
          throw new Error("Data after terminal event");
        }

        if (event.type === "metadata") {
          const conversationMismatch =
            pending.conversationId &&
            pending.conversationId !== event.conversation_id;
          const turnMismatch =
            pending.turnId && pending.turnId !== event.turn_id;

          if (receivedMetadata || conversationMismatch || turnMismatch) {
            throw new Error("Mismatched turn metadata");
          }
          receivedMetadata = true;

          if (unfinished.current.get("draft")?.pending === pending) {
            unfinished.current.delete("draft");
          }

          pending.conversationId = event.conversation_id;
          pending.turnId = event.turn_id;
          pending.userServerId = event.user_message_id;
          pending.assistantServerId = event.assistant_message_id;

          view.current.id = event.conversation_id!;
          setSelectedId(view.current.id);
          writeSelection(view.current.id);

          display((old) =>
            old.map((message) => {
              if (message.id === pending.userMessageId) {
                return { ...message, serverId: pending.userServerId };
              }
              if (message.id === pending.agentMessageId) {
                return { ...message, serverId: pending.assistantServerId };
              }
              return message;
            }),
          );
          remember();
          void refreshList();
          return;
        }

        if (!receivedMetadata) {
          throw new Error("Missing turn metadata");
        }

        switch (event.type) {
          case "chunk":
            setProgress("");
            updateAgentMessage((message) => ({
              ...message,
              content: message.content + event.content,
            }));
            break;

          case "status":
            setProgress(event.content ?? "");
            break;

          case "error":
            setProgress("");
            display((old) => [
              ...old,
              {
                id: crypto.randomUUID(),
                role: "error",
                content: event.content ?? "",
              },
            ]);
            break;

          case "result":
            updateAgentMessage((message) => ({
              ...message,
              results: event.results,
              unavailableResults: event.unavailable_results ?? 0,
            }));
            break;

          case "done": {
            const mismatched =
              event.turn_id !== pending.turnId ||
              event.conversation_id !== pending.conversationId ||
              (event.persisted &&
                event.message_id !== pending.assistantServerId);

            if (mismatched) {
              throw new Error("Mismatched saved outcome");
            }
            receivedDone = true;

            updateAgentMessage((message) => ({
              ...message,
              outcome: event.persisted ? event.outcome : "unknown",
            }));

            if (event.persisted) {
              rows.current = rows.current.map((row) =>
                row.turn_id === pending.turnId && row.role !== "tool"
                  ? { ...row, status: event.outcome! }
                  : row,
              );
              setStoredRows(rows.current);
              view.current.pending = null;
              unfinished.current.delete(pending.conversationId!);
            } else {
              remember();
              setRetryTurn(pending);
            }
            break;
          }
        }
      });

      if (isCurrent() && !receivedDone) {
        throw new Error("Stream ended without confirmation");
      }
    } catch (error) {
      if (
        epoch.current === currentEpoch &&
        streamAbort.current === controller
      ) {
        setNotice(
          controller.signal.aborted
            ? "Response stopped. Its saved outcome is not confirmed; retry or reload messages."
            : errorText(error),
        );

        if (view.current.pending) {
          const rejected =
            error instanceof OracleApiError &&
            [401, 404, 422].includes(error.status);

          updateAgentMessage((message) => ({
            ...message,
            outcome: rejected ? "failed" : "unknown",
          }));

          if (rejected) {
            view.current.pending = null;
            unfinished.current.delete(pending.conversationId ?? "draft");
          } else {
            remember();
            setRetryTurn(pending);
          }
        }
      }
    } finally {
      clearTimeout(timeout);

      if (
        epoch.current === currentEpoch &&
        streamAbort.current === controller
      ) {
        streamAbort.current = null;
        setLoading(false);
        setProgress("");
        setPendingDraft(unfinished.current.has("draft"));
        void refreshList();
      }
    }
  };

  // ---- Archive / draft -----------------------------------------------------
  const archiveConversation = async () => {
    if (
      !selected ||
      streamAbort.current ||
      historyAbort.current ||
      mutationAbort.current ||
      view.current.pending ||
      hasRecentActiveTurn(rows.current)
    ) {
      return;
    }

    const currentEpoch = epoch.current;
    const id = selected.id;
    const controller = new AbortController();
    mutationAbort.current = controller;

    setMutating(true);
    setNotice("");

    try {
      const conversation = await api.archive(
        id,
        !selected.archived_at,
        boundedSignal(controller),
      );

      if (epoch.current !== currentEpoch || controller.signal.aborted) {
        return;
      }

      setSelected(conversation);
      void refreshList();
    } catch (error) {
      if (epoch.current === currentEpoch && !controller.signal.aborted) {
        setNotice(errorText(error));
      }
    } finally {
      if (epoch.current === currentEpoch) {
        mutationAbort.current = null;
        setMutating(false);
      }
    }
  };

  const deleteConversation = async () => {
    if (
      !selected ||
      streamAbort.current ||
      historyAbort.current ||
      mutationAbort.current ||
      view.current.pending ||
      hasRecentActiveTurn(rows.current)
    ) {
      return;
    }
    const currentEpoch = epoch.current;
    const id = selected.id;
    const controller = new AbortController();
    mutationAbort.current = controller;
    setMutating(true);
    setNotice("");
    try {
      await api.delete(id, boundedSignal(controller));
      if (epoch.current !== currentEpoch || controller.signal.aborted) {
        return;
      }
      unfinished.current.delete(id);
      view.current.pending = null;
      setConversations((old) => old.filter((item) => item.id !== id));
      await openConversation(null, false);
      void refreshList();
    } catch (error) {
      if (epoch.current === currentEpoch && !controller.signal.aborted) {
        setNotice(errorText(error));
      }
    } finally {
      if (epoch.current === currentEpoch) {
        mutationAbort.current = null;
        setMutating(false);
      }
    }
  };

  const resumeDraft = () => {
    const cached = unfinished.current.get("draft");
    if (!cached) {
      return;
    }

    remember();
    cancelView();

    rows.current = [];
    cursor.current = null;
    view.current = {
      id: null,
      pending: cached.pending,
      messages: cached.messages,
    };

    setStoredRows([]);
    setSelected(null);
    setSelectedId(null);
    setMessageCursor(null);
    setHistoryLoading(false);
    setHistoryError("");
    setInput("");
    display(cached.messages);
    setRetryTurn(cached.pending);
    writeSelection(null, true);
  };

  // ---- Derived state -------------------------------------------------------
  const recentActive = hasRecentActiveTurn(storedRows);
  const isArchived = !!selected?.archived_at;
  const blocked =
    loading ||
    historyLoading ||
    mutating ||
    !!historyError ||
    !!messageCursor ||
    !!retryTurn ||
    recentActive ||
    isArchived;

  return {
    conversations,
    listLoading,
    listError,
    listCursor,
    includeArchived,
    selected,
    selectedId,
    messages,
    input,
    setInput,
    loading,
    progress,
    historyLoading,
    historyError,
    messageCursor,
    retryTurn,
    mutating,
    notice,
    pendingDraft,
    recentActive,
    isArchived,
    blocked,
    openConversation,
    refreshList,
    loadMoreMessages,
    handleSend,
    archiveConversation,
    deleteConversation,
    resumeDraft,
    reloadMessages: () => openConversation(view.current.id, false),
    stopResponse: () => streamAbort.current?.abort(),
    toggleArchived: (include: boolean) => {
      filter.current = include;
      setIncludeArchived(include);
      void refreshList();
    },
  };
}

export type OracleChatController = ReturnType<typeof useOracleChat>;
