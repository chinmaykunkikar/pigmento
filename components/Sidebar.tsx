"use client";

import { cn } from "@/lib/cn";
import type { Source } from "@/lib/db/schema";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useTree } from "@/lib/queries/tree";
import { useExplorerStore } from "@/lib/store";
import { ChevronLeft, ChevronRight, Folder } from "./icons";
import { formatCombo, KbdHint } from "./primitives/KbdHint";
import { ScrollArea } from "./primitives/ScrollArea";
import { FolderTree } from "./tree/FolderTree";
import { SourceSwitcher } from "./tree/SourceSwitcher";

type Props = {
  sources: Source[];
  selectedSourceId: number | null;
  selectedFolder: string | null;
  onSelectSource: (id: number) => void;
  onSelectFolder: (path: string) => void;
};

export function Sidebar({
  sources,
  selectedSourceId,
  selectedFolder,
  onSelectSource,
  onSelectFolder,
}: Props) {
  const tree = useTree(selectedSourceId);
  const collapsed = useExplorerStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useExplorerStore((s) => s.toggleSidebar);
  const viewportForcesCollapse = useMediaQuery("(max-width: 1023.98px)");
  const effectiveCollapsed = collapsed || viewportForcesCollapse;

  if (effectiveCollapsed) {
    const expandDisabled = viewportForcesCollapse;
    return (
      <aside className="flex w-9 flex-shrink-0 flex-col items-center border-r border-border bg-surface py-2">
        <button
          type="button"
          onClick={expandDisabled ? undefined : toggleSidebar}
          disabled={expandDisabled}
          aria-label="Expand sidebar"
          title={
            expandDisabled ? "Viewport too narrow for expanded sidebar" : "Expand sidebar (⌘B)"
          }
          className="flex h-7 w-7 items-center justify-center rounded-sm text-text-3 transition-colors hover:bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight size={14} strokeWidth={1.75} />
        </button>
        <div className="my-2 h-px w-5 bg-border" />
        <button
          type="button"
          onClick={() => {
            if (!expandDisabled) toggleSidebar();
            onSelectFolder("");
          }}
          aria-label="Open folder tree"
          className="flex h-7 w-7 items-center justify-center rounded-sm text-text-3 transition-colors hover:bg-hover hover:text-text"
        >
          <Folder size={14} strokeWidth={1.5} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-65 flex-shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-1 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <SourceSwitcher
            sources={sources}
            selectedId={selectedSourceId}
            onSelect={onSelectSource}
          />
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
          title="Collapse sidebar (⌘B)"
          className={cn(
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm text-text-3",
            "transition-colors hover:bg-hover hover:text-text",
          )}
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
        </button>
      </div>

      <ScrollArea className="flex-1">
        {tree.isLoading ? (
          <div className="p-3 text-xs text-text-3">Loading tree…</div>
        ) : tree.isError ? (
          <div className="p-3 text-xs text-danger">Failed to load tree</div>
        ) : tree.data ? (
          <FolderTree root={tree.data} selectedPath={selectedFolder} onSelect={onSelectFolder} />
        ) : null}
      </ScrollArea>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-text-3">
        <span className="truncate">
          {tree.data ? `${tree.data.count.toLocaleString()} assets` : "-"}
        </span>
        <KbdHint keys={formatCombo("mod+b")} className="flex-shrink-0" />
      </div>
    </aside>
  );
}
