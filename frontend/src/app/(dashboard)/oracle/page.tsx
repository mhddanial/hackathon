"use client";

import { useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  History,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { ConversationList } from "@/components/oracle/ConversationList";
import { DeleteConversationDialog } from "@/components/oracle/DeleteConversationDialog";
import { OracleComposer } from "@/components/oracle/OracleComposer";
import { OracleMessages } from "@/components/oracle/OracleMessages";
import { useOracleChat } from "@/hooks/use-oracle-chat";

export default function OracleChatPage() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Loading Oracle…</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  if (!user) return <p>Sign in to view your Oracle conversations.</p>;
  return <OracleChat key={user.id} userId={user.id} />;
}

function OracleChat({ userId }: { userId: string }) {
  const chat = useOracleChat(userId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const title =
    chat.selected?.title ||
    (chat.selectedId ? "Untitled conversation" : "New conversation");
  const mutationBlocked =
    chat.loading ||
    chat.historyLoading ||
    chat.mutating ||
    !!chat.retryTurn ||
    chat.recentActive;
  const openConversation = (id: string | null) => {
    setHistoryOpen(false);
    void chat.openConversation(id);
  };
  const history = (
    <ConversationList
      items={chat.conversations}
      selected={chat.selectedId}
      loading={chat.listLoading}
      error={chat.listError}
      includeArchived={chat.includeArchived}
      more={!!chat.listCursor}
      pendingDraft={chat.pendingDraft}
      onNew={() => openConversation(null)}
      onSelect={openConversation}
      onReload={() => {
        void chat.refreshList();
      }}
      onMore={() => {
        void chat.refreshList(chat.listCursor ?? undefined);
      }}
      onArchived={chat.toggleArchived}
      onResume={() => {
        setHistoryOpen(false);
        chat.resumeDraft();
      }}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-var(--header-height)-var(--dashboard-inset)-var(--dashboard-padding)-var(--dashboard-padding))] min-h-0 min-w-0 flex-col">
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-xl py-0 shadow-xs ring-1 ring-border">
        <section
          aria-label="Oracle workspace"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-5">
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 rounded-lg"
                    aria-label="Open conversation history"
                    title="Open conversation history"
                  />
                }
              >
                <History className="size-4" />
              </SheetTrigger>
              <SheetContent side="left" className="gap-0">
                <SheetHeader className="border-b pr-14">
                  <SheetTitle>Your conversations</SheetTitle>
                  <SheetDescription>
                    Pick up where you left off.
                  </SheetDescription>
                </SheetHeader>
                <aside
                  aria-label="Conversation history"
                  className="min-h-0 flex-1"
                >
                  {history}
                </aside>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1 basis-28">
              <h1 className="truncate text-sm font-semibold">
                Logistics Oracle
              </h1>
              {chat.selectedId ? (
                <h2
                  className="mt-0.5 truncate text-xs text-muted-foreground"
                  title={title}
                >
                  {title}
                </h2>
              ) : (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  Routes, congestion, and schedules in one conversation.
                </p>
              )}
              {chat.isArchived && (
                <Badge
                  variant="secondary"
                  className="mt-1 text-[10px] font-normal"
                >
                  Archived
                </Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-lg"
                aria-label="New conversation"
                title="New conversation"
                onClick={() => openConversation(null)}
              >
                <Plus className="size-4" />
              </Button>
              {chat.selectedId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-lg text-muted-foreground"
                  aria-label="Reload messages"
                  title="Reload messages"
                  disabled={
                    chat.loading || chat.historyLoading || chat.mutating
                  }
                  onClick={() => {
                    void chat.reloadMessages();
                  }}
                >
                  <RefreshCw
                    className={`size-4 ${chat.historyLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              )}
              {chat.selected && (
                <>
                  <Button
                    variant="outline"
                    className="size-9 rounded-lg px-0 text-xs font-medium @lg/main:w-auto @lg/main:px-3"
                    aria-label={chat.isArchived ? "Restore" : "Archive"}
                    title={
                      chat.isArchived
                        ? "Restore conversation"
                        : "Archive conversation"
                    }
                    disabled={mutationBlocked}
                    onClick={() => {
                      void chat.archiveConversation();
                    }}
                  >
                    {chat.isArchived ? (
                      <ArchiveRestore className="size-4" />
                    ) : (
                      <Archive className="size-4" />
                    )}
                    <span className="hidden @lg/main:inline">
                      {chat.isArchived ? "Restore" : "Archive"}
                    </span>
                  </Button>
                  <DeleteConversationDialog
                    key={chat.selected.id}
                    title={title}
                    disabled={mutationBlocked}
                    onConfirm={() => {
                      void chat.deleteConversation();
                    }}
                  />
                </>
              )}
            </div>
          </header>
          <OracleMessages
            key={chat.selectedId ?? "draft"}
            messages={chat.messages}
            welcome={
              !chat.selectedId &&
              chat.messages.length === 1 &&
              chat.messages[0].id === "oracle-greeting"
            }
            blocked={chat.blocked}
            historyError={chat.historyError}
            historyLoading={chat.historyLoading}
            hasMore={!!chat.messageCursor}
            onReload={() => {
              void chat.reloadMessages();
            }}
            onMore={() => {
              void chat.loadMoreMessages();
            }}
            onPrompt={(prompt) => {
              chat.setInput(prompt);
              inputRef.current?.focus();
            }}
          />
          <OracleComposer
            inputRef={inputRef}
            input={chat.input}
            setInput={chat.setInput}
            blocked={chat.blocked}
            notice={chat.notice}
            isArchived={chat.isArchived}
            recentActive={chat.recentActive}
            retryTurn={chat.retryTurn}
            loading={chat.loading}
            progress={chat.progress}
            historyLoading={chat.historyLoading}
            messageCursor={chat.messageCursor}
            handleSend={chat.handleSend}
            stopResponse={chat.stopResponse}
          />
        </section>
      </Card>
    </div>
  );
}
