"use client";

import { useMemo, useState } from "react";
import type { NearPair as NearPairT } from "@/lib/db/queries/duplicates";
import { useNearDuplicates } from "@/lib/queries/duplicates";
import { HammingHistogram } from "./HammingHistogram";
import { NearPair } from "./NearPair";

type Props = { sourceId: number; sourceLabel: string };

type Bucket = {
  name: string;
  description: string;
  pairs: NearPairT[];
};

const DEFAULT_THRESHOLD = 14;
const MIN_THRESHOLD = 0;
const MAX_THRESHOLD = 16;

export function NearTab({ sourceId, sourceLabel }: Props) {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const q = useNearDuplicates(sourceId);

  const buckets = useMemo<Bucket[]>(() => {
    const all = q.data?.pairs ?? [];
    const filtered = all.filter((p) => p.hamming <= threshold);
    const very: NearPairT[] = [];
    const similar: NearPairT[] = [];
    const loose: NearPairT[] = [];
    for (const p of filtered) {
      if (p.bucket === "very") very.push(p);
      else if (p.bucket === "similar") similar.push(p);
      else loose.push(p);
    }
    return [
      { name: "Very similar", description: "Δ ≤ 4 · almost certainly redundant", pairs: very },
      { name: "Similar", description: "Δ 5–8 · review before merging", pairs: similar },
      { name: "Loosely similar", description: "Δ 9+ · likely not redundant", pairs: loose },
    ].filter((b) => b.pairs.length > 0);
  }, [q.data?.pairs, threshold]);

  if (q.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-3">
        Loading near duplicates…
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-danger">
        {(q.error as Error).message}
      </div>
    );
  }
  const data = q.data;
  if (!data || data.pairs.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-sm text-text-3">
        <span>No near duplicates</span>
        <span className="text-xs text-text-4">
          No perceptual-hash pairs fall within the clustering threshold
        </span>
      </div>
    );
  }

  const visiblePairs = buckets.reduce((n, b) => n + b.pairs.length, 0);

  return (
    <>
      <div className="mx-4 mt-3 flex items-center gap-4 rounded-sm border border-border bg-surface px-3.5 py-2.5">
        <div className="flex-1">
          <div className="text-sm font-medium text-text">
            {data.pairs.length} near-duplicate {data.pairs.length === 1 ? "pair" : "pairs"}
            {threshold < MAX_THRESHOLD ? (
              <span className="ml-2 font-mono text-xs text-text-3">
                · {visiblePairs} within Δ ≤ {threshold}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 font-mono text-xs text-text-3">
            perceptual hash distance · review manually; not all are truly redundant
          </div>
        </div>
        <HammingHistogram bins={data.histogram} threshold={threshold} />
        <input
          type="range"
          min={MIN_THRESHOLD}
          max={MAX_THRESHOLD}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="h-1 w-35 cursor-pointer accent-[var(--color-accent)]"
          aria-label="Hamming threshold"
        />
      </div>

      <div className="flex flex-col gap-4.5 px-4 pb-4 pt-3">
        {buckets.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10 text-sm text-text-3">
            No pairs within Δ ≤ {threshold}
          </div>
        ) : (
          buckets.map((b) => (
            <div key={b.name}>
              <div className="mb-2 flex items-center gap-2 pl-0.5">
                <span className="text-2xs font-semibold uppercase tracking-wider text-text-3">
                  {b.name}
                </span>
                <span className="rounded-sm bg-sunken px-1.5 py-px font-mono text-2xs font-medium text-text-2">
                  {b.pairs.length}
                </span>
                <span className="font-mono text-2xs text-text-4">{b.description}</span>
                <div className="h-px flex-1 bg-divider" />
              </div>
              <div className="flex flex-col gap-2">
                {b.pairs.map((p) => (
                  <NearPair
                    key={`${p.clusterId}-${p.b.assetId}`}
                    pair={p}
                    sourceId={sourceId}
                    sourceLabel={sourceLabel}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
