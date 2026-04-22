"use client";

import type { Source } from "@/lib/db/schema";
import { useTree } from "@/lib/queries/tree";
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

  return (
    <aside className="flex w-65 flex-shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-3 py-2.5">
        <SourceSwitcher sources={sources} selectedId={selectedSourceId} onSelect={onSelectSource} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {tree.isLoading ? (
          <div className="p-3 text-xs text-text-3">Loading tree…</div>
        ) : tree.isError ? (
          <div className="p-3 text-xs text-danger">Failed to load tree</div>
        ) : tree.data ? (
          <FolderTree root={tree.data} selectedPath={selectedFolder} onSelect={onSelectFolder} />
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-text-3">
        <span>{tree.data ? `${tree.data.count.toLocaleString()} assets` : "—"}</span>
        <span className="font-mono text-[10px]">v0.0.0</span>
      </div>
    </aside>
  );
}
