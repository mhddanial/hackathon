"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OracleResults } from "@/components/oracle/OracleResults";
import { OracleMarkdown } from "@/components/oracle/OracleMarkdown";
import { OracleWelcome } from "@/components/oracle/OracleWelcome";
import type { DisplayMessage } from "@/types/oracle";

type Props = {
  messages: DisplayMessage[];
  welcome: boolean;
  blocked: boolean;
  historyError: string;
  historyLoading: boolean;
  hasMore: boolean;
  onReload: () => void;
  onMore: () => void;
  onPrompt: (prompt: string) => void;
};

function outcomeLabel(outcome: DisplayMessage["outcome"]) {
  switch (outcome) {
    case "streaming":
      return "Provisional response…";
    case "in_progress":
      return "Turn in progress. Reload to check its outcome.";
    case "unknown":
      return "Saved outcome not confirmed.";
    case "interrupted":
      return "This turn was interrupted.";
    default:
      return "This turn failed.";
  }
}

function Message({ message }: { message: DisplayMessage }) {
  const content =
    message.content ||
    (message.outcome === "in_progress" || message.outcome === "streaming"
      ? "The answer has not been saved yet."
      : "No answer text was saved for this turn.");
  // Progress belongs to the active request, never the saved transcript.
  if (message.role === "status") return null;
  if (message.role === "error")
    return (
      <Alert variant="destructive">
        <AlertDescription className="whitespace-pre-wrap">
          {content}
        </AlertDescription>
      </Alert>
    );
  const user = message.role === "user";
  return (
    <article
      data-message-id={message.serverId}
      aria-label={user ? "Your message" : "Oracle response"}
      className={`flex min-w-0 gap-3 ${user ? "justify-end" : ""}`}
    >
      {!user && (
        <div
          aria-hidden="true"
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-primary/5 text-primary"
        >
          <Sparkles className="size-3.5" />
        </div>
      )}
      <div
        className={
          user
            ? "max-w-[90%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-primary-foreground sm:max-w-[80%]"
            : "min-w-0 flex-1 pt-1"
        }
      >
        {!user && <p className="mb-2 text-xs font-semibold">Oracle</p>}
        {user ? (
          <p className="text-sm leading-7 whitespace-pre-wrap [overflow-wrap:anywhere]">
            {content}
          </p>
        ) : (
          <OracleMarkdown content={content} />
        )}
        {!user && message.outcome && message.outcome !== "completed" && (
          <p className="mt-2 text-xs text-muted-foreground">
            {outcomeLabel(message.outcome)}
          </p>
        )}
        {!user && (
          <OracleResults
            results={message.results}
            unavailable={message.unavailableResults}
            outcome={message.outcome}
          />
        )}
      </div>
    </article>
  );
}

export function OracleMessages(props: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [showJump, setShowJump] = useState(false);
  useEffect(() => {
    const element = scrollRef.current;
    if (element && (props.welcome || pinned.current)) {
      element.scrollTop = props.welcome ? 0 : element.scrollHeight;
    }
  }, [props.messages, props.historyLoading, props.hasMore, props.welcome]);

  const jump = () => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    pinned.current = true;
    setShowJump(false);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions text"
        onScroll={(event) => {
          const element = event.currentTarget;
          pinned.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            96;
          setShowJump(!pinned.current);
        }}
        className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
      >
        <div
          className={`mx-auto flex min-h-full max-w-3xl flex-col ${props.welcome ? "" : "gap-7"}`}
        >
          {props.historyError && (
            <Alert variant="destructive">
              <AlertDescription>
                {props.historyError}
                <Button
                  variant="ghost"
                  className="h-8 rounded-lg px-2 text-xs"
                  onClick={props.onReload}
                >
                  Retry messages
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {props.welcome ? (
            <OracleWelcome disabled={props.blocked} onPrompt={props.onPrompt} />
          ) : (
            props.messages.map((message) => (
              <Message key={message.id} message={message} />
            ))
          )}
          {props.historyLoading && (
            <div role="status" className="space-y-2">
              <span className="sr-only">Loading messages…</span>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
          {props.hasMore && (
            <div className="flex flex-col items-start gap-3 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
              <p>
                More saved messages are available. Load them before sending a
                follow-up.
              </p>
              <Button
                variant="outline"
                className="h-9 rounded-lg text-xs font-medium"
                disabled={props.historyLoading}
                onClick={props.onMore}
              >
                Load more messages
              </Button>
            </div>
          )}
        </div>
      </div>
      {showJump && !props.welcome && (
        <Button
          variant="outline"
          className="absolute bottom-3 left-1/2 h-8 -translate-x-1/2 gap-2 bg-background px-3 text-xs font-medium shadow-sm"
          onClick={jump}
        >
          <ArrowDown className="size-3.5" />
          Jump to latest
        </Button>
      )}
    </div>
  );
}
