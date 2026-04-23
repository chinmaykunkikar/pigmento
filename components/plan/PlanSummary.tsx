import type { PlanStats } from "@/lib/plan/schema";
import { formatBytes } from "@/lib/time";

type Props = { stats: PlanStats };

export function PlanSummary({ stats }: Props) {
  const items: { label: string; value: string }[] = [
    { label: "Actions", value: stats.actionCount.toString() },
    { label: "Files", value: stats.fileCount.toString() },
    { label: "Refs", value: stats.refCount.toString() },
    { label: "Reclaimed", value: formatBytes(stats.reclaimableBytes) },
  ];

  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-sm border border-border bg-border">
      {items.map((i) => (
        <div key={i.label} className="flex flex-col gap-0.5 bg-surface px-3 py-2.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-3">
            {i.label}
          </span>
          <span className="font-mono text-md text-text tabular-nums">{i.value}</span>
        </div>
      ))}
    </div>
  );
}
