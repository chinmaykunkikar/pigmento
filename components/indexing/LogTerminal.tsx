import { cn } from "@/lib/cn";
import type { IndexerRun, LogEntry } from "@/lib/queries/indexer-status";

type Props = { run: IndexerRun };

export function LogTerminal({ run }: Props) {
  return (
    <div className="mt-5">
      <div className="font-mono text-xs text-text-3">tail -f indexer.log</div>
      <div className="mt-1.5 rounded-sm bg-text p-3 font-mono text-2xs leading-relaxed text-[#e8e6e2]">
        {run.log.length === 0 ? (
          <div className="text-[#8a8782]">waiting for events…</div>
        ) : (
          run.log.map((entry) => <LogLine key={entry.id} entry={entry} start={run.startedAt} />)
        )}
      </div>
    </div>
  );
}

function LogLine({ entry, start }: { entry: LogEntry; start: number }) {
  const rel = Math.max(0, entry.t - start);
  return (
    <div>
      <span className="text-[#8a8782]">{fmtRel(rel)}</span>{" "}
      <span
        className={cn(
          entry.level === "ok" && "text-[#6fc77a]",
          entry.level === "warn" && "text-[#f0c050]",
          entry.level === "info" && "text-[#e8e6e2]",
        )}
      >
        {entry.text}
      </span>
    </div>
  );
}

function fmtRel(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const millis = ms % 1000;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad3(millis)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}
