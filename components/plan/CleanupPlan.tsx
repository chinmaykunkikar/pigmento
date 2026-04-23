"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { computeStats } from "@/lib/plan/schema";
import { useExplorerStore } from "@/lib/store";
import { ChevronRight, Trash2 } from "../icons";
import { DispatchTab } from "./DispatchTab";
import { ExportTab } from "./ExportTab";
import { PlanItemCard } from "./PlanItemCard";
import { PlanSummary } from "./PlanSummary";
import { PromptTab } from "./PromptTab";

type Tab = "plan" | "prompt" | "export" | "dispatch";

const TABS: { value: Tab; label: string }[] = [
  { value: "plan", label: "Plan" },
  { value: "prompt", label: "Prompt" },
  { value: "export", label: "Export" },
  { value: "dispatch", label: "Dispatch" },
];

type Props = { sourceLabel: string };

export function CleanupPlan({ sourceLabel }: Props) {
  const [tab, setTab] = useState<Tab>("plan");
  const plan = useExplorerStore((s) => s.draftPlan);
  const removePlanAction = useExplorerStore((s) => s.removePlanAction);
  const renamePlan = useExplorerStore((s) => s.renamePlan);
  const clearPlan = useExplorerStore((s) => s.clearPlan);

  const empty = !plan || plan.actions.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
        <span className="font-mono text-xs text-text-3">Actions</span>
        <ChevronRight size={12} strokeWidth={1.75} className="text-text-4" />
        <span className="font-sans text-sm font-semibold text-text">Cleanup plan</span>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ok">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
          agent ready
        </span>
      </div>

      <div className="flex h-9 flex-shrink-0 items-center gap-1 border-b border-border bg-surface px-4">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "h-7 rounded-sm px-3 font-sans text-sm font-medium transition-colors",
              tab === t.value
                ? "bg-accent-bg text-accent-text"
                : "text-text-2 hover:bg-hover hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        {plan && plan.actions.length > 0 ? (
          <button
            type="button"
            onClick={clearPlan}
            className="inline-flex h-7 items-center gap-1 rounded-sm px-2 font-mono text-xs text-text-3 transition-colors hover:bg-hover hover:text-danger"
          >
            <Trash2 size={12} strokeWidth={1.75} />
            Clear plan
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex max-w-200 flex-col gap-3 px-4 py-4">
          {plan ? (
            <input
              value={plan.name}
              onChange={(e) => renamePlan(e.target.value)}
              className="h-8 rounded-sm border border-border bg-surface px-2.5 font-sans text-sm font-medium text-text outline-none focus:border-accent/40"
              aria-label="Plan name"
            />
          ) : null}

          {plan ? <PlanSummary stats={computeStats(plan)} /> : null}

          {tab === "plan" ? (
            <div className="flex flex-col gap-3">
              {plan
                ? plan.actions.map((a) => (
                    <PlanItemCard key={a.id} action={a} onRemove={() => removePlanAction(a.id)} />
                  ))
                : null}
              <DropPrompt empty={empty} sourceLabel={sourceLabel} />
            </div>
          ) : null}

          {tab === "prompt" && plan ? <PromptTab plan={plan} /> : null}
          {tab === "export" && plan ? <ExportTab plan={plan} /> : null}
          {tab === "dispatch" && plan ? <DispatchTab plan={plan} /> : null}
          {tab !== "plan" && !plan ? (
            <div className="rounded-sm border border-border bg-surface px-4 py-8 text-center font-sans text-sm text-text-3">
              Queue at least one action in the Plan tab to generate{" "}
              {tab === "prompt" ? "a prompt" : tab === "export" ? "exports" : "a dispatch"}.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DropPrompt({ empty, sourceLabel }: { empty: boolean; sourceLabel: string }) {
  return (
    <div className="rounded-sm border border-border-2 border-dashed bg-surface px-4 py-5 text-center">
      <div className="font-sans text-sm text-text-2">
        {empty ? `Add actions for ${sourceLabel}` : "Add another action"}
      </div>
      <div className="mt-1 font-mono text-xs text-text-3">
        Open Duplicates or Grouped and click{" "}
        <span className="rounded-xs bg-sunken px-1 py-px">Add to plan</span> on any cluster or pair.
      </div>
    </div>
  );
}
