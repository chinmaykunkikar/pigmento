"use client";

import type { ReactNode } from "react";
import type { OverviewCounts } from "@/lib/db/queries/overview";
import { useOverviewCounts } from "@/lib/queries/overview";
import { useExplorerStore } from "@/lib/store";
import { formatBytes, relativeTime } from "@/lib/time";
import { ArrowRight, Layers, LayoutGrid, ScanSearch, SquareStack, TriangleAlert } from "../icons";
import { ErrorState } from "../primitives/ErrorState";
import { ScrollArea } from "../primitives/ScrollArea";

type Props = {
  sourceId: number;
  sourceLabel: string;
  lastIndexedAt: string | null;
};

export function PostIndexOverview({ sourceId, sourceLabel, lastIndexedAt }: Props) {
  const q = useOverviewCounts(sourceId);
  const setView = useExplorerStore((s) => s.setView);
  const setUnusedOnly = useExplorerStore((s) => s.setUnusedOnly);

  const rows = q.data ? buildRows(q.data) : [];

  const go = (target: Row["target"]) => () => {
    if (target.view === "grid") setUnusedOnly(target.unusedOnly ?? false);
    setView(target.view, { manual: true });
  };

  return (
    <ScrollArea className="flex-1 bg-bg">
      <div className="mx-auto flex max-w-160 flex-col gap-4 px-6 pt-8 pb-10">
        <header className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-sans text-xl font-semibold text-text">Overview</h1>
            <p className="mt-0.5 font-mono text-xs text-text-3">
              <span className="text-text-2">{sourceLabel}</span>
              {lastIndexedAt ? (
                <>
                  <span className="mx-1 text-text-4">·</span>
                  indexed {relativeTime(lastIndexedAt)}
                </>
              ) : null}
            </p>
          </div>
          {q.data && q.data.totalAssets > 0 ? (
            <span className="font-mono text-xs text-text-3 tabular-nums">
              {q.data.totalAssets.toLocaleString()} assets · {formatBytes(q.data.totalBytes)}
            </span>
          ) : null}
        </header>

        {q.isLoading ? (
          <div className="py-10 text-center font-mono text-xs text-text-3">Computing overview…</div>
        ) : q.isError ? (
          <ErrorState
            error={q.error}
            title="Couldn't compute overview"
            onRetry={() => q.refetch()}
          />
        ) : !q.data || q.data.totalAssets === 0 ? (
          <div className="py-10 text-center font-mono text-xs text-text-3">
            No assets indexed yet. Re-index this source to populate the overview.
          </div>
        ) : (
          <div className="overflow-hidden rounded-sm border border-border bg-surface">
            {rows.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={go(r.target)}
                className={
                  i === 0
                    ? "group/ov-row flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover"
                    : "group/ov-row flex w-full items-center gap-3 border-t border-divider px-4 py-3 text-left transition-colors hover:bg-hover"
                }
              >
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xs ${r.iconBg}`}
                >
                  {r.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-sans text-sm font-medium text-text">{r.label}</span>
                    <span className="font-mono text-xs text-text-3 tabular-nums">
                      {r.countLabel}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-text-3">{r.detail}</div>
                </div>
                <span className="flex flex-shrink-0 items-center gap-1 font-sans text-xs text-text-3 transition-colors group-hover/ov-row:text-accent">
                  {r.cta}
                  <ArrowRight size={11} strokeWidth={1.75} />
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="font-mono text-xs text-text-4">
          ` jumps back here at any time. Use 1/2/3 to navigate views, 4 to toggle the cleanup plan.
        </p>
      </div>
    </ScrollArea>
  );
}

type Row = {
  id: string;
  label: string;
  countLabel: string;
  detail: string;
  cta: string;
  icon: ReactNode;
  iconBg: string;
  target: {
    view: "grid" | "clusters";
    unusedOnly?: boolean;
    clustersMode?: "exact" | "near" | "name";
  };
};

function buildRows(c: OverviewCounts): Row[] {
  const out: Row[] = [];

  if (c.duplicateGroups > 0) {
    out.push({
      id: "duplicates",
      label: "Exact duplicates",
      countLabel: `${c.duplicateGroups.toLocaleString()} ${
        c.duplicateGroups === 1 ? "group" : "groups"
      }`,
      detail:
        c.exactReclaimableBytes > 0
          ? `${formatBytes(c.exactReclaimableBytes)} reclaimable by deduplication`
          : "byte-identical copies to merge",
      cta: "Review",
      icon: <SquareStack size={14} strokeWidth={1.5} className="text-accent-text" />,
      iconBg: "bg-accent-bg",
      target: { view: "clusters", clustersMode: "exact" },
    });
  }

  if (c.nearMatchClusters > 0) {
    out.push({
      id: "near",
      label: "Near matches",
      countLabel: `${c.nearMatchClusters.toLocaleString()} ${
        c.nearMatchClusters === 1 ? "cluster" : "clusters"
      }`,
      detail: "perceptually similar, not byte-identical",
      cta: "Inspect",
      icon: <ScanSearch size={14} strokeWidth={1.5} className="text-text-2" />,
      iconBg: "bg-sunken",
      target: { view: "clusters", clustersMode: "near" },
    });
  }

  if (c.unusedAssets > 0) {
    out.push({
      id: "unused",
      label: "Unused assets",
      countLabel: `${c.unusedAssets.toLocaleString()} ${c.unusedAssets === 1 ? "asset" : "assets"}`,
      detail:
        c.unusedBytes > 0
          ? `${formatBytes(c.unusedBytes)} with no references in the codebase`
          : "no references in the codebase",
      cta: "Audit",
      icon: <TriangleAlert size={14} strokeWidth={1.5} className="text-warn" />,
      iconBg: "bg-warn-bg",
      target: { view: "grid", unusedOnly: true },
    });
  }

  if (c.nameClusters > 0) {
    out.push({
      id: "name",
      label: "Name variants",
      countLabel: `${c.nameClusters.toLocaleString()} ${
        c.nameClusters === 1 ? "cluster" : "clusters"
      }`,
      detail: "assets that share a canonical stem (size variants, brand/mono, etc.)",
      cta: "Open",
      icon: <Layers size={14} strokeWidth={1.5} className="text-text-2" />,
      iconBg: "bg-sunken",
      target: { view: "clusters", clustersMode: "name" },
    });
  }

  out.push({
    id: "all",
    label: "Browse all assets",
    countLabel: `${c.totalAssets.toLocaleString()} total`,
    detail: "open the full grid with no filters",
    cta: "Browse",
    icon: <LayoutGrid size={14} strokeWidth={1.5} className="text-text-2" />,
    iconBg: "bg-sunken",
    target: { view: "grid" },
  });

  return out;
}
