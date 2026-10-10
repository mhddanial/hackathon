import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import type { Conversation } from "@/types/oracle";

type Props = {
  items: Conversation[]; selected: string | null; loading: boolean; error: string;
  includeArchived: boolean; more: boolean; pendingDraft: boolean;
  onSelect: (id: string) => void; onNew: () => void; onReload: () => void;
  onMore: () => void; onArchived: (include: boolean) => void; onResume: () => void;
};
export function ConversationList(props: Props) {
  return <aside aria-label="Conversation history" className="w-full lg:w-64 shrink-0 border border-[#E2E8F0] rounded-2xl bg-white flex flex-col overflow-hidden max-h-72 lg:max-h-none">
    <div className="p-4 border-b border-[#E2E8F0] space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-[#1A1D27]">Saved conversations</h2>
        <Button variant="ghost" size="icon" aria-label="Reload conversations" onClick={props.onReload} disabled={props.loading}><RefreshCw className="w-4 h-4" /></Button></div>
      <Button className="w-full" variant="outline" onClick={props.onNew}><Plus className="w-4 h-4 mr-2" />New conversation</Button>
      <label className="flex items-center gap-2 text-xs text-[#5E6470]"><input type="checkbox" checked={props.includeArchived} onChange={event => props.onArchived(event.target.checked)} />Include archived</label>
      {props.pendingDraft && <Button className="w-full" variant="outline" onClick={props.onResume}>Check unfinished request</Button>}
    </div>
    <div className="p-2 overflow-y-auto flex-1 min-h-0">
      {props.error && <div role="alert" className="p-2 text-sm text-red-700">{props.error}<Button variant="ghost" onClick={props.onReload}>Retry history</Button></div>}
      {props.loading && <p role="status" className="p-2 text-sm text-[#5E6470]">Loading conversations…</p>}
      {!props.loading && !props.error && props.items.length === 0 && <p className="p-2 text-sm text-[#5E6470]">No saved conversations yet. Start a new conversation.</p>}
      {props.items.map(item => <button key={item.id} aria-current={item.id === props.selected ? "true" : undefined}
        onClick={() => props.onSelect(item.id)} className={`w-full text-left rounded-lg p-3 mb-1 border ${item.id === props.selected ? "bg-blue-50 border-blue-200" : "border-transparent hover:bg-slate-50"}`}>
        <span className="block truncate text-sm font-medium">{item.title || "Untitled conversation"}</span>
        <span className="block text-xs text-[#5E6470] mt-1">{new Date(item.updated_at).toLocaleDateString()}{item.archived_at ? " · Archived" : ""}</span>
      </button>)}
      {props.more && <Button className="w-full" variant="ghost" disabled={props.loading} onClick={props.onMore}>Load more conversations</Button>}
    </div>
  </aside>;
}
