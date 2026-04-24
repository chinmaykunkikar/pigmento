"use client";

import { useEffect, useState } from "react";
import type { IndexerRun } from "@/lib/queries/indexer-status";

type Props = { run: IndexerRun };

export function IndexingStrip({ run }: Props) {
  const elapsed = useElapsed(run.startedAt, run.endedAt);
  const doneCount = run.stages.filter((s) => s.status === "done").length;
  const activeStage = run.stages.find((s) => s.status === "active") ?? null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="animate-[slide-down-in_220ms_var(--ease-out-quart)] flex h-9 flex-shrink-0 items-center gap-3 border-t border-border bg-surface px-4 font-mono text-xs text-text-3"
    >
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
          aria-hidden
        />
        <span className="text-text-2">
          {run.endedAt ? "Indexed" : "Re-indexing"} {run.label}
        </span>
      </span>
      <span className="text-text-4">·</span>
      <span>
        {activeStage ? (
          <span className="text-text">{activeStage.label}</span>
        ) : run.endedAt ? (
          <span className="text-ok">complete</span>
        ) : (
          <span>starting…</span>
        )}
      </span>
      <div className="flex-1" />
      <span className="tabular-nums">
        {doneCount} / {run.stages.length} stages
      </span>
      <span className="text-text-4">·</span>
      <span className="tabular-nums">{fmtElapsed(elapsed)}</span>
    </div>
  );
}

function useElapsed(start: number, end: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (end !== null) {
      setNow(end);
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [end]);
  return Math.max(0, (end ?? now) - start);
}

function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
