"use client";

import { cn } from "@/lib/cn";
import type { PlanAction } from "@/lib/plan/schema";
import { useExplorerStore } from "@/lib/store";
import { Check, Plus } from "../icons";

type Props = {
  action: PlanAction;
  sourceId: number;
  sourceLabel: string;
  size?: "sm" | "md";
  className?: string;
};

export function AddToPlanButton({ action, sourceId, sourceLabel, size = "md", className }: Props) {
  const draftPlan = useExplorerStore((s) => s.draftPlan);
  const addPlanAction = useExplorerStore((s) => s.addPlanAction);
  const removePlanAction = useExplorerStore((s) => s.removePlanAction);

  const queued = draftPlan?.actions.some((a) => a.id === action.id) ?? false;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (queued) removePlanAction(action.id);
        else addPlanAction(action, sourceId, sourceLabel);
      }}
      aria-pressed={queued}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border font-mono text-xs transition-colors",
        size === "sm" ? "h-6 px-1.5" : "h-7 px-2",
        queued
          ? "border-accent/30 bg-accent-bg text-accent-text hover:bg-accent-bg/80"
          : "border-border bg-surface text-text-2 hover:border-border-2 hover:bg-hover hover:text-text",
        className,
      )}
      title={queued ? "Remove from plan" : "Add to cleanup plan"}
    >
      {queued ? (
        <>
          <Check size={11} strokeWidth={2} />
          In plan
        </>
      ) : (
        <>
          <Plus size={11} strokeWidth={2} />
          Add to plan
        </>
      )}
    </button>
  );
}
