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
          <X size={12} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex flex-col">
        {action.kind === "merge-exact" || action.kind === "merge-cluster" ? (
          <Row
            kind="keep"
            relPath={action.keep.relPath}
            size={action.keep.size}
            refs={action.keep.usageCount}
          />
        ) : null}
        {action.kind === "review-group" ? (
          <>
            {action.note ? (
              <div className="border-b border-divider px-3 py-1.5 font-mono text-xs text-text-3 italic">
                {action.note}
              </div>
            ) : null}
            {action.assetRefs.map((r) => (
              <Row
                key={r.assetId}
                kind="review"
                relPath={r.relPath}
                size={r.size}
                refs={r.usageCount}
              />
            ))}
          </>
        ) : action.kind === "rename-asset" ? (
          <>
            <Row
              kind="from"
              relPath={action.asset.relPath}
              size={action.asset.size}
              refs={action.asset.usageCount}
            />
            <Row kind="to" relPath={action.newRelPath} size={action.asset.size} refs={0} />
          </>
        ) : (
          action.drop.map((d) => (
            <Row
              key={d.assetId}
              kind={action.kind === "delete-unused" ? "delete" : "drop"}
              relPath={d.relPath}
              size={d.size}
              refs={d.usageCount}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KindChip({ kind }: { kind: PlanAction["kind"] }) {
  const label =
    kind === "merge-exact"
      ? "MERGE EXACT"
      : kind === "merge-cluster"
        ? "MERGE CLUSTER"
        : kind === "review-group"
          ? "REVIEW"
          : kind === "rename-asset"
            ? "RENAME"
            : "DELETE";
  const tone =
    kind === "delete-unused"
      ? "bg-danger-bg text-danger"
      : kind === "review-group"
        ? "bg-warn-bg text-warn"
        : "bg-accent-bg text-accent-text";
  return (
    <span
      className={cn(
        "rounded-xs px-1.5 py-0.5 font-mono text-3xs font-semibold uppercase tracking-wider",
        tone,
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
  kind: "keep" | "drop" | "delete" | "review" | "from" | "to";
  relPath: string;
  size: number;
  refs: number;
}) {
  const kindLabel =
    kind === "keep"
      ? "KEEP"
      : kind === "delete"
        ? "DELETE"
        : kind === "review"
          ? "REVIEW"
          : kind === "from"
            ? "FROM"
            : kind === "to"
              ? "TO"
              : "DROP";
  const kindClass =
    kind === "keep"
      ? "text-ok"
      : kind === "delete"
        ? "text-danger"
        : kind === "review"
          ? "text-warn"
          : kind === "from"
            ? "text-text-3"
            : kind === "to"
              ? "text-accent-text"
              : "text-warn";
  const showRefs = kind !== "to";
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
        {showRefs ? `${refs} ref${refs === 1 ? "" : "s"}` : ""}
      </span>
    </div>
  );
}
