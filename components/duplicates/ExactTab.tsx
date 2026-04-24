"use client";

import { useExactDuplicates } from "@/lib/queries/duplicates";
import { formatBytes } from "@/lib/time";
import { ErrorState } from "../primitives/ErrorState";
import { DupGroup } from "./DupGroup";

type Props = { sourceId: number; sourceLabel: string };

export function ExactTab({ sourceId, sourceLabel }: Props) {
  const q = useExactDuplicates(sourceId);

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
          disabled
          className="inline-flex h-6.5 cursor-not-allowed items-center rounded-sm border-none bg-accent px-2.5 text-sm font-medium text-surface opacity-60"
        >
          Preview migration
        </button>
        <button
          type="button"
          disabled
          className="inline-flex h-6.5 cursor-not-allowed items-center rounded-sm border border-border-2 bg-surface px-2.5 text-sm font-medium text-text opacity-60"
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
