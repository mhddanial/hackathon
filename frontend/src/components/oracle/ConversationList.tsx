"use client";

import { useId, useState } from "react";
import {
  Archive,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation } from "@/types/oracle";

type Props = {
  items: Conversation[];
  selected: string | null;
  loading: boolean;
  error: string;
  includeArchived: boolean;
  more: boolean;
  pendingDraft: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onReload: () => void;
  onMore: () => void;
  onArchived: (include: boolean) => void;
  onResume: () => void;
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Jakarta",
});

function conversationTitle(item: Conversation) {
  return item.title?.replace(/\s+/g, " ").trim() || "Untitled conversation";
}

export function ConversationList(props: Props) {
  const [query, setQuery] = useState("");
  const archivedId = useId();
  const search = query.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const visible = props.items.filter((item) =>
    conversationTitle(item).toLocaleLowerCase().includes(search),
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/25">
      <div className="space-y-4 border-b p-4">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-sm font-semibold">Saved conversations</h2>
          <Badge variant="secondary" className="font-normal">
            {props.items.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label="Reload conversations"
            onClick={props.onReload}
            disabled={props.loading}
          >
            <RefreshCw
              className={`size-4 ${props.loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        <Button
          className="h-10 w-full rounded-lg font-medium"
          onClick={props.onNew}
        >
          <Plus className="size-4" />
          New conversation
        </Button>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search conversations"
            placeholder="Search conversations…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 rounded-lg pr-9 pl-9 text-sm [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 size-8 rounded-md"
              aria-label="Clear conversation search"
              onClick={() => setQuery("")}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={archivedId}
            checked={props.includeArchived}
            onCheckedChange={props.onArchived}
          />
          <label
            htmlFor={archivedId}
            className="cursor-pointer text-xs text-muted-foreground"
          >
            Include archived
          </label>
        </div>
        {props.pendingDraft && (
          <Button
            className="h-auto w-full rounded-lg py-2 text-xs font-medium"
            variant="outline"
            onClick={props.onResume}
          >
            Check unfinished request
          </Button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2">
          {props.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {props.error}
                <Button
                  variant="ghost"
                  className="h-8 rounded-lg px-2 text-xs"
                  onClick={props.onReload}
                >
                  Retry history
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {props.loading && (
            <div role="status" className="space-y-3 p-3">
              <span className="sr-only">Loading conversations…</span>
              {[0, 1, 2].map((item) => (
                <div key={item} className="space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          )}
          {!props.loading && !props.error && visible.length === 0 && (
            <p className="px-3 py-8 text-center text-sm leading-relaxed text-muted-foreground">
              {search
                ? "No matching conversations. Try a different search."
                : "No saved conversations yet. Start a new conversation."}
            </p>
          )}
          {visible.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              aria-current={item.id === props.selected ? "true" : undefined}
              title={conversationTitle(item)}
              onClick={() => props.onSelect(item.id)}
              className={`h-auto w-full justify-start gap-3 rounded-lg border px-3 py-3 text-left font-normal ${item.id === props.selected ? "border-primary/15 bg-primary/8 text-foreground hover:bg-primary/12" : "border-transparent"}`}
            >
              <MessageSquare
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {conversationTitle(item)}
                </span>
                <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {dateFormat.format(new Date(item.updated_at))}
                  {item.archived_at && (
                    <>
                      <span aria-hidden="true">·</span>
                      <Archive aria-hidden="true" className="size-3" />
                      Archived
                    </>
                  )}
                </span>
              </span>
            </Button>
          ))}
          {props.more && (
            <div className="pt-2">
              {search && (
                <p className="px-3 text-xs text-muted-foreground">
                  Load older chats to include them in search.
                </p>
              )}
              <Button
                className="h-9 w-full rounded-lg text-xs font-medium"
                variant="ghost"
                disabled={props.loading}
                onClick={props.onMore}
              >
                Load more conversations
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
      <p className="border-t px-4 py-3 text-[11px] text-muted-foreground">
        Your conversations are saved to your account.
      </p>
    </div>
  );
}
