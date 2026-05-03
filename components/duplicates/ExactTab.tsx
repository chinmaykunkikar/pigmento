"use client";

import { mergeExactActionFromGroup } from "@/lib/plan/build";
import { useExactDuplicates } from "@/lib/queries/duplicates";
import { useExplorerStore } from "@/lib/store";
import { formatBytes } from "@/lib/time";
import { ErrorState } from "../primitives/ErrorState";
import { DupGroup } from "./DupGroup";

type Props = { sourceId: number; sourceLabel: string };

export function ExactTab({ sourceId, sourceLabel }: Props) {
  const q = useExactDuplicates(sourceId);
  const addPlanAction = useExplorerStore((s) => s.addPlanAction);
  const setPlanDrawerOpen = useExplorerStore((s) => s.setPlanDrawerOpen);

  if (q.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-3">
        Loading exact duplicates…
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="m-4">
        <ErrorState
          error={q.error}
          title="Couldn't load exact duplicates"
          onRetry={() => q.refetch()}
        />
      </div>
    );
  }
  const data = q.data;
  if (!data || data.groups.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-sm text-text-3">
        <span>No exact duplicates</span>
        <span className="text-xs text-text-4">Every content hash is unique across this source</span>
      </div>
    );
  }

  const collapseTo = data.totalGroups;
  const collapseFrom = data.totalFiles;

  const previewMigration = () => {
    for (const group of data.groups) {
      addPlanAction(mergeExactActionFromGroup(group), sourceId, sourceLabel);
    }
    setPlanDrawerOpen(true);
  };

  const exportReport = () => {
    const report = {
      version: "pika/duplicates v1",
      generatedAt: new Date().toISOString(),
      source: { id: sourceId, label: sourceLabel },
      stats: {
        totalGroups: data.totalGroups,
        totalFiles: data.totalFiles,
        reclaimableBytes: data.reclaimableBytes,
      },
      groups: data.groups.map((g) => ({
        hashKey: g.key,
        perFileSize: g.perFileSize,
        reclaimableBytes: g.reclaimableBytes,
        canonical: {
          name: g.canonicalName,
          relPath: g.members.find((m) => m.assetId === g.canonicalId)?.relPath ?? g.canonicalName,
        },
        duplicates: g.members
          .filter((m) => m.assetId !== g.canonicalId)
          .map((m) => ({ name: m.name, relPath: m.relPath, usageCount: m.usageCount })),
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `pika-duplicates-${sourceLabel.replace(/[^a-z0-9-]+/gi, "-")}-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mx-4 mt-3 flex items-center gap-3.5 rounded-sm border border-l-(length:--border-status) border-border border-l-accent bg-sunken px-3.5 py-2.5">
        <div className="font-mono text-xl font-semibold text-text tabular-nums">
          {formatBytes(data.reclaimableBytes)}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-text">Reclaimable by deduplication</div>
          <div className="mt-0.5 font-mono text-xs text-text-3">
            {data.totalGroups} exact-duplicate {data.totalGroups === 1 ? "group" : "groups"} ·{" "}
            {collapseFrom} files will collapse to {collapseTo}
          </div>
        </div>
        <button
          type="button"
          onClick={previewMigration}
          data-plan-trigger="true"
          className="inline-flex h-6.5 items-center rounded-sm border border-info/30 bg-info-bg px-2.5 text-sm font-medium text-info-text transition-colors hover:border-info/50 hover:bg-info-bg/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Preview migration
        </button>
        <button
          type="button"
          onClick={exportReport}
          className="inline-flex h-6.5 items-center rounded-sm border border-border-2 bg-surface px-2.5 text-sm font-medium text-text transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Export report
        </button>
      </div>

      <div className="flex flex-col gap-2 px-4 pb-4 pt-3">
        {data.groups.map((g, i) => (
          <DupGroup
            key={g.id}
            group={g}
            defaultOpen={i === 0}
            sourceId={sourceId}
            sourceLabel={sourceLabel}
          />
        ))}
      </div>
    </>
  );
}
