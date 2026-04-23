import { cn } from "@/lib/cn";
import { actionTitle, type PlanAction } from "@/lib/plan/schema";
import { formatBytes } from "@/lib/time";
import { X } from "../icons";

type Props = {
  action: PlanAction;
  onRemove: () => void;
};

export function PlanItemCard({ action, onRemove }: Props) {
  return (
    <div className="overflow-hidden rounded-sm border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
        <KindChip kind={action.kind} />
        <span className="flex-1 truncate font-sans text-sm font-medium text-text">
          {actionTitle(action)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove action"
          className="flex-shrink-0 rounded-xs p-0.5 text-text-3 transition-colors hover:bg-hover hover:text-text-2"
        >
          <X size={13} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex flex-col">
        {action.kind !== "delete-unused" ? (
          <Row
            kind="keep"
            relPath={action.keep.relPath}
            size={action.keep.size}
            refs={action.keep.usageCount}
          />
        ) : null}
        {action.drop.map((d) => (
          <Row
            key={d.assetId}
            kind={action.kind === "delete-unused" ? "delete" : "drop"}
            relPath={d.relPath}
            size={d.size}
            refs={d.usageCount}
          />
        ))}
      </div>
    </div>
  );
}

function KindChip({ kind }: { kind: PlanAction["kind"] }) {
  const label =
    kind === "merge-exact" ? "MERGE EXACT" : kind === "merge-cluster" ? "MERGE CLUSTER" : "DELETE";
  return (
    <span
      className={cn(
        "rounded-xs px-1.5 py-0.5 font-mono text-3xs font-semibold uppercase tracking-wider",
        kind === "delete-unused" ? "bg-danger-bg text-danger" : "bg-accent-bg text-accent-text",
      )}
    >
      {label}
    </span>
  );
}

function Row({
  kind,
  relPath,
  size,
  refs,
}: {
  kind: "keep" | "drop" | "delete";
  relPath: string;
  size: number;
  refs: number;
}) {
  const kindLabel = kind === "keep" ? "KEEP" : kind === "delete" ? "DELETE" : "DROP";
  const kindClass = kind === "keep" ? "text-ok" : kind === "delete" ? "text-danger" : "text-warn";
  return (
    <div className="flex items-center gap-2 border-divider border-b px-3 py-1.5 last:border-b-0">
      <span
        className={cn(
          "w-14 flex-shrink-0 font-mono text-3xs font-semibold uppercase tracking-wider",
          kindClass,
        )}
      >
        {kindLabel}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-2" title={relPath}>
        {relPath}
      </span>
      <span className="flex-shrink-0 font-mono text-xs text-text-3 tabular-nums">
        {formatBytes(size)}
      </span>
      <span className="w-14 flex-shrink-0 text-right font-mono text-xs text-text-3 tabular-nums">
        {refs} ref{refs === 1 ? "" : "s"}
      </span>
    </div>
  );
}
