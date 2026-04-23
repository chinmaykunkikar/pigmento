import { cn } from "@/lib/cn";
import type { StageState } from "@/lib/queries/indexer-status";
import { Check } from "../icons";

type Props = {
  stage: StageState;
  isFirst: boolean;
};

export function StageRow({ stage, isFirst }: Props) {
  const { status, label, detail, ms } = stage;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 transition-colors duration-200 ease-[var(--ease-out-quart)]",
        status === "active" && "bg-accent-bg/40",
        isFirst ? "" : "border-t border-divider",
      )}
    >
      <StatusDot status={status} />
      <span
        className={cn(
          "flex-1 font-sans text-sm font-medium transition-colors duration-200 ease-[var(--ease-out-quart)]",
          status === "pending" ? "text-text-3" : "text-text",
        )}
      >
        {label}
      </span>
      <span className="min-w-30 text-right font-mono text-xs text-text-3 tabular-nums">
        {renderCount(status, detail, ms)}
      </span>
    </div>
  );
}

function renderCount(status: StageState["status"], detail: string | null, ms: number | null) {
  if (status === "pending") return "—";
  if (status === "active") return "running…";
  if (detail && ms !== null) return `${detail} · ${fmtMs(ms)}`;
  if (detail) return detail;
  return "done";
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function StatusDot({ status }: { status: StageState["status"] }) {
  if (status === "done") {
    return (
      <span
        key="done"
        className="flex h-3.5 w-3.5 flex-shrink-0 animate-[stage-pop_260ms_var(--ease-out-expo)] items-center justify-center rounded-full bg-ok text-white"
      >
        <Check size={9} strokeWidth={2.5} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span key="active" className="relative h-3.5 w-3.5 flex-shrink-0">
        <span className="absolute inset-0 animate-[ping-ring_1400ms_var(--ease-out-quart)_infinite] rounded-full bg-accent/20" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </span>
    );
  }
  return (
    <span
      key="pending"
      className="h-3.5 w-3.5 flex-shrink-0 rounded-full border border-border-2 bg-surface"
    />
  );
}
