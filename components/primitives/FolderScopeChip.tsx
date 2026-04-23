"use client";

import { useExplorerStore } from "@/lib/store";
import { X } from "../icons";

export function FolderScopeChip() {
  const selectedFolder = useExplorerStore((s) => s.selectedFolder);
  const setSelectedFolder = useExplorerStore((s) => s.setSelectedFolder);

  if (!selectedFolder) return null;

  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-xs border border-accent/30 bg-accent-bg px-1.5 font-mono text-2xs text-accent-text">
      <span className="text-text-3">in</span>
      <span className="max-w-35 truncate" title={selectedFolder}>
        {selectedFolder}
      </span>
      <button
        type="button"
        onClick={() => setSelectedFolder("")}
        aria-label="Clear folder scope"
        className="flex h-3.5 w-3.5 items-center justify-center rounded-xs text-text-3 transition-colors hover:bg-hover hover:text-text"
      >
        <X size={10} strokeWidth={2} />
      </button>
    </span>
  );
}
