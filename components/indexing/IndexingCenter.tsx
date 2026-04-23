"use client";

import { useEffect, useState } from "react";
import type { IndexerRun } from "@/lib/queries/indexer-status";
import { LogTerminal } from "./LogTerminal";
import { StageRow } from "./StageRow";

type Props = { run: IndexerRun };

export function IndexingCenter({ run }: Props) {
  const elapsed = useElapsed(run.startedAt, run.endedAt);
  const doneCount = run.stages.filter((s) => s.status === "done").length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex h-8 flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
        <span className="flex items-center gap-1.5 font-mono text-xs text-text-3">
          <span
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
            aria-hidden
          />
          Indexing {run.label}
          {run.endedAt ? " · complete" : "…"}
        </span>
        <div className="flex-1" />
        <span className="font-mono text-xs text-text-3 tabular-nums">
          {doneCount} / {run.stages.length} stages · {fmtElapsed(elapsed)}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-160 px-4 py-4">
          <div className="mb-3 font-sans text-base font-semibold text-text">Indexing pipeline</div>
          <div className="overflow-hidden rounded-sm border border-border bg-surface">
            {run.stages.map((s, i) => (
              <StageRow key={s.key} stage={s} isFirst={i === 0} />
            ))}
          </div>
          <LogTerminal run={run} />
        </div>
      </div>
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
    const id = setInterval(() => setNow(Date.now()), 250);
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
