"use client";

import { useEffect, useRef, useState } from "react";
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
  const [ping, setPing] = useState(false);
  const prevQueuedRef = useRef(queued);

  useEffect(() => {
    if (!prevQueuedRef.current && queued) {
      setPing(true);
      const id = setTimeout(() => setPing(false), 600);
      return () => clearTimeout(id);
    }
    prevQueuedRef.current = queued;
  }, [queued]);

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
        "relative inline-flex items-center gap-1 rounded-sm border font-mono text-xs transition-colors duration-200 ease-[var(--ease-out-quart)]",
        size === "sm" ? "h-6 px-1.5" : "h-7 px-2",
        queued
          ? "border-accent/30 bg-accent-bg text-accent-text hover:bg-accent-bg/80"
          : "border-border bg-surface text-text-2 hover:border-border-2 hover:bg-hover hover:text-text",
        className,
      )}
      title={queued ? "Remove from plan" : "Add to cleanup plan"}
    >
      {ping ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-[ping-ring_540ms_var(--ease-out-expo)] rounded-sm bg-accent/40"
        />
      ) : null}
      {queued ? (
        <>
          <Check size={12} strokeWidth={1.75} />
          In plan
        </>
      ) : (
        <>
          <Plus size={12} strokeWidth={1.75} />
          Add to plan
        </>
      )}
    </button>
  );
}
