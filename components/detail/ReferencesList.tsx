"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { UsageRow } from "@/lib/db/queries/asset-detail";
import { useAssetUsages } from "@/lib/queries/asset";

type Props = { assetId: number; totalCount: number };

export function ReferencesList({ assetId, totalCount }: Props) {
  const q = useAssetUsages(assetId);

  const rows: UsageRow[] = useMemo(() => q.data?.pages.flat() ?? [], [q.data]);
  const uniqueFiles = useMemo(() => new Set(rows.map((r) => r.relPath)).size, [rows]);
  const commentedCount = useMemo(() => rows.filter((r) => r.commented).length, [rows]);

  if (q.isLoading) {
    return (
      <div className="border-b border-border px-3 py-3 text-xs text-text-3">
        Loading references…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="border-b border-border px-3 py-3 text-xs text-text-3">
        No references found
      </div>
    );
  }

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-3">
          References
        </span>
        <span className="rounded-xs bg-sunken px-1.5 py-px font-mono text-2xs font-medium text-text-2 tabular-nums">
          {totalCount}
        </span>
        {commentedCount > 0 ? (
          <span
            title="Some references are inside comments"
            className="rounded-xs bg-warn-bg px-1.5 py-px font-mono text-2xs font-medium text-warn tabular-nums"
          >
            {commentedCount} commented
          </span>
        ) : null}
        <div className="flex-1" />
        <span className="font-mono text-2xs text-text-3 tabular-nums">
          {uniqueFiles} file{uniqueFiles === 1 ? "" : "s"}
        </span>
      </div>

      <div className="pb-2">
        {rows.map((r) => (
          <RefItem key={r.id} row={r} />
        ))}
      </div>

      {q.hasNextPage ? (
        <div className="border-t border-divider px-3 py-2">
          <button
            type="button"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="inline-flex h-6 items-center gap-1 rounded-xs font-mono text-2xs text-text-3 transition-colors hover:text-text disabled:opacity-50"
          >
            {q.isFetchingNextPage
              ? "Loading…"
              : `Load ${Math.min(50, totalCount - rows.length)} more`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RefItem({ row }: { row: UsageRow }) {
  return (
    <div className="border-t border-divider px-3 py-1.5 first:border-t-0">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-mono text-xs",
            row.commented ? "text-text-3" : "text-text",
          )}
          title={`${row.relPath}:${row.line}`}
        >
          {row.relPath}
          <span className="text-text-3">:{row.line}</span>
        </span>
        {row.commented ? (
          <span
            title="This reference is inside a comment"
            className="flex-shrink-0 rounded-xs bg-warn-bg px-1 py-px font-mono text-3xs font-semibold uppercase tracking-wider text-warn"
          >
            Commented
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-0.5 truncate rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-2xs",
          row.commented ? "text-text-3 italic" : "text-text-2",
        )}
      >
        {row.snippet}
      </div>
    </div>
  );
}
