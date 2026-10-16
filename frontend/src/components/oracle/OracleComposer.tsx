"use client";

import { useId, type RefObject } from "react";
import { ArrowUp, LoaderCircle, RotateCcw, Square } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_MESSAGE_LENGTH,
  type OracleChatController,
} from "@/hooks/use-oracle-chat";

type Props = Pick<
  OracleChatController,
  | "input"
  | "setInput"
  | "blocked"
  | "notice"
  | "isArchived"
  | "recentActive"
  | "retryTurn"
  | "loading"
  | "progress"
  | "historyLoading"
  | "messageCursor"
  | "handleSend"
  | "stopResponse"
> & { inputRef: RefObject<HTMLTextAreaElement | null> };

export function OracleComposer({ inputRef, ...props }: Props) {
  const hintId = useId();
  const send = () => {
    if (!props.blocked && props.input.trim())
      void props.handleSend(props.input);
  };

  return (
    <div className="shrink-0 border-t bg-card px-4 pt-3 pb-3 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-3">
        {props.notice && (
          <Alert variant="destructive">
            <AlertDescription>{props.notice}</AlertDescription>
          </Alert>
        )}
        {props.isArchived && (
          <Alert>
            <AlertDescription>
              This conversation is archived. Restore it to send a follow-up.
            </AlertDescription>
          </Alert>
        )}
        {props.recentActive && !props.loading && !props.retryTurn && (
          <Alert>
            <AlertDescription>
              An earlier turn is still active. Reload messages to check it;
              stale turns can recover after three minutes.
            </AlertDescription>
          </Alert>
        )}
        {props.retryTurn && !props.loading && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              This request needs its saved outcome checked.
            </p>
            <Button
              variant="outline"
              className="h-8 rounded-lg px-3 text-xs font-medium"
              disabled={
                props.historyLoading ||
                !!props.messageCursor ||
                props.isArchived
              }
              onClick={() => {
                if (props.retryTurn)
                  void props.handleSend(
                    props.retryTurn.message,
                    props.retryTurn,
                  );
              }}
            >
              <RotateCcw className="size-3.5" />
              Retry this turn
            </Button>
          </div>
        )}
        {props.loading && (
          <div className="flex items-center justify-between gap-3">
            <p
              role="status"
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <LoaderCircle className="size-3.5 animate-spin" />
              {props.progress || "Oracle is responding…"}
            </p>
            <Button
              variant="outline"
              className="h-8 rounded-lg px-3 text-xs font-medium"
              onClick={props.stopResponse}
            >
              <Square className="size-3" />
              Stop response
            </Button>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="rounded-xl border bg-card p-2 shadow-xs transition-shadow focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
        >
          <Textarea
            ref={inputRef}
            aria-label="Message Oracle"
            aria-describedby={hintId}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={props.blocked}
            value={props.input}
            onChange={(event) => props.setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Ask about congestion, routes, or schedules…"
            className="max-h-36 min-h-14 resize-none rounded-lg border-0 bg-transparent px-2 py-2.5 text-base shadow-none focus-visible:ring-0 md:text-sm"
          />
          <div className="flex items-center justify-between gap-2 px-2 pt-1">
            <p id={hintId} className="text-[11px] text-muted-foreground">
              <span className="hidden sm:inline">
                Enter to send · Shift + Enter for a new line
              </span>
              <span className="sm:hidden">
                Ask a follow-up or start a new conversation
              </span>
            </p>
            <div className="flex items-center gap-3">
              {props.input.length > MAX_MESSAGE_LENGTH * 0.8 && (
                <span
                  className="text-[11px] tabular-nums text-muted-foreground"
                  aria-live="polite"
                >
                  {props.input.length.toLocaleString()} /{" "}
                  {MAX_MESSAGE_LENGTH.toLocaleString()}
                </span>
              )}
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                className="size-8 rounded-lg"
                disabled={props.blocked || !props.input.trim()}
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </form>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Estimates and recorded data may have unknown freshness. Check result
          details before planning.
        </p>
      </div>
    </div>
  );
}
