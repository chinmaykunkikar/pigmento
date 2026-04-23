"use client";

import type { GroupSort } from "@/lib/db/queries/groups";
import { FolderScopeChip } from "../primitives/FolderScopeChip";

type Props = {
  sourceLabel: string;
  total: number;
  totalVariants: number;
  sort: GroupSort;
  onSortChange: (s: GroupSort) => void;
};

export function GroupedBreadcrumb({
  sourceLabel,
  total,
  totalVariants,
  sort,
  onSortChange,
}: Props) {
  return (
    <div className="flex h-8 flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
      <span className="font-mono text-xs text-text-3">
        <span className="text-text">{sourceLabel}</span>
        <span className="text-text-4"> / </span>
        <span className="text-text">clusters</span>
      </span>

      <FolderScopeChip />

      <div className="flex-1" />

      <span className="font-mono text-xs text-text-3 tabular-nums">
        {total.toLocaleString()} clusters · {totalVariants.toLocaleString()} variants
      </span>
      <span className="h-3 w-px bg-border" />
      <div className="flex items-center gap-1 text-xs text-text-3">
        <span>Sort:</span>
        <button
          type="button"
          onClick={() => onSortChange("size")}
          className={sort === "size" ? "text-text" : "hover:text-text"}
        >
          Size
        </button>
        <span className="text-text-4">·</span>
        <button
          type="button"
          onClick={() => onSortChange("alpha")}
          className={sort === "alpha" ? "text-text" : "hover:text-text"}
        >
          A–Z
        </button>
      </div>
    </div>
  );
}
