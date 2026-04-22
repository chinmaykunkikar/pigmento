"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import type { UsageRow } from "@/lib/db/queries/asset-detail";
import { useAssetUsages } from "@/lib/queries/asset";

const ROW_HEIGHT = 48;

type Props = { assetId: number; totalCount: number };

export function ReferencesList({ assetId, totalCount }: Props) {
  const q = useAssetUsages(assetId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows: UsageRow[] = useMemo(() => q.data?.pages.flat() ?? [], [q.data]);
  const uniqueFiles = useMemo(() => new Set(rows.map((r) => r.relPath)).size, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const last = items[items.length - 1];
    if (!last) return;
    if (last.index >= rows.length - 4 && q.hasNextPage && !q.isFetchingNextPage) {
      q.fetchNextPage();
    }
  }, [virtualizer, rows.length, q]);

  if (q.isLoading) {
    return <div className="px-3 py-4 text-xs text-text-3">Loading references…</div>;
  }
  if (rows.length === 0) {
    return <div className="px-3 py-4 text-xs text-text-3">No references found</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-3">
          References
        </span>
        <span className="rounded-xs bg-sunken px-1.5 py-px font-mono text-[10px] font-medium text-text-2">
          {totalCount}
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[10px] text-text-3">
          {uniqueFiles} file{uniqueFiles === 1 ? "" : "s"}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vr) => {
            const r = rows[vr.index];
            if (!r) return null;
            return (
              <div
                key={vr.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${vr.start}px)`,
                  height: ROW_HEIGHT,
                }}
              >
                <RefItem row={r} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RefItem({ row }: { row: UsageRow }) {
  return (
    <div className="border-b border-divider px-3 py-1.5">
      <div
        className="truncate font-mono text-[11px] text-text"
        title={`${row.relPath}:${row.line}`}
      >
        {row.relPath}
        <span className="text-text-3">:{row.line}</span>
      </div>
      <div className="mt-0.5 truncate rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-[10.5px] text-text-2">
        {row.snippet}
      </div>
    </div>
  );
}
