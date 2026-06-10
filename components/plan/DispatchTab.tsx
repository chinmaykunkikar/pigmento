"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Plan } from "@/lib/plan/schema";
import {
  type DispatchHarness,
  type DispatchMode,
  type DispatchResult,
  useDispatchPlan,
} from "@/lib/queries/dispatch";
import { useReindex } from "@/lib/queries/reindex";
import { RefreshCw } from "../icons";
import { Button } from "../primitives/Button";
import { ErrorState } from "../primitives/ErrorState";
import { DispatchLogViewer } from "./DispatchLogViewer";

type Props = { plan: Plan };

// only adapters that actually run belong here; add entries when they land in
// lib/plan/dispatch/registry.ts, not before
const HARNESSES: { value: DispatchHarness; label: string }[] = [
  { value: "claude-code", label: "Claude Code" },
];

const MODES: { value: DispatchMode; label: string; ready: boolean; description: string }[] = [
  {
    value: "dry-run",
    label: "Dry run",
    ready: true,
    description: "Write plan files only. No mutations.",
  },
  {
    value: "patch",
    label: "Patch only",
    ready: true,
    description: "Agent rewrites files locally, no commit.",
  },
  {
    value: "open-pr",
    label: "Open PR",
    ready: true,
    description: "Agent commits, pushes, and opens a PR.",
  },
];

export function DispatchTab({ plan }: Props) {
  const [harness, setHarness] = useState<DispatchHarness>("claude-code");
  const [mode, setMode] = useState<DispatchMode>("dry-run");
  const dispatch = useDispatchPlan();

  const canSend = plan.actions.length > 0 && !dispatch.isPending;
  const notReady = MODES.find((m) => m.value === mode)?.ready === false;
  const readyMsg = notReady ? `${mode} is not implemented yet` : null;

  return (
    <div className="flex flex-col gap-4">
      <Section label="Harness">
        <div className="flex gap-1.5">
          {HARNESSES.map((h) => (
            <button
              key={h.value}
              type="button"
              onClick={() => setHarness(h.value)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 font-sans text-xs font-medium transition-colors",
                harness === h.value
                  ? "border-accent bg-accent-bg text-accent-text"
                  : "border-border bg-surface text-text-2 hover:border-border-2 hover:bg-hover",
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Mode">
        <div className="flex flex-col gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              disabled={!m.ready}
              className={cn(
                "flex items-center gap-2 rounded-sm border px-3 py-2 text-left transition-colors",
                mode === m.value
                  ? "border-accent bg-accent-bg"
                  : "border-border bg-surface hover:border-border-2 hover:bg-hover",
                !m.ready && "cursor-not-allowed opacity-50",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border",
                  mode === m.value ? "border-accent" : "border-border-2",
                )}
              >
                {mode === m.value ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
              </span>
              <span className="flex-1">
                <span className="font-sans text-sm font-medium text-text">{m.label}</span>
                <span className="ml-2 font-mono text-xs text-text-3">{m.description}</span>
              </span>
              {!m.ready ? <span className="font-mono text-2xs text-text-4">soon</span> : null}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Command preview">
        <pre className="overflow-auto rounded-sm bg-text p-3 font-mono text-2xs leading-relaxed text-[#e8e6e2]">
          {`pnpm pika plan send --mode ${mode} --harness ${harness} ${plan.id}.json`}
        </pre>
      </Section>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-text-3">
          {plan.actions.length} action{plan.actions.length === 1 ? "" : "s"} queued
        </span>
        <div className="flex-1" />
        <Button
          variant="primary"
          disabled={!canSend || !!readyMsg}
          onClick={() => dispatch.mutate({ plan, mode, harness })}
          className="h-8 gap-2 px-3"
        >
          Send plan to agent
        </Button>
      </div>

      {readyMsg ? (
        <div className="rounded-sm border border-border border-l-(length:--border-status) border-l-warn bg-warn-bg px-3 py-2 font-mono text-xs text-warn">
          {readyMsg}
        </div>
      ) : null}

      {dispatch.isPending ? (
        <div className="rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-text-3">
          Writing plan files…
        </div>
      ) : null}

      {dispatch.data ? (
        <DispatchResultCard
          data={dispatch.data}
          harness={harness}
          mode={mode}
          sourceId={plan.sourceId}
        />
      ) : null}
      {dispatch.error ? (
        <ErrorState
          error={dispatch.error}
          title="Dispatch failed"
          onRetry={() => dispatch.mutate({ plan, mode, harness })}
        />
      ) : null}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-2xs font-semibold uppercase tracking-wider text-text-3">{label}</span>
      {children}
    </div>
  );
}

function DispatchResultCard({
  data,
  harness,
  mode,
  sourceId,
}: {
  data: DispatchResult;
  harness: DispatchHarness;
  mode: DispatchMode;
  sourceId: number;
}) {
  const reindex = useReindex(sourceId);
  const mutatesWorkingTree = mode !== "dry-run";
  return (
    <div className="flex flex-col gap-3">
      <div className="animate-[slide-down-in_260ms_var(--ease-out-quart)] rounded-sm border border-border border-l-(length:--border-status) border-l-ok bg-surface">
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <span className="rounded-xs bg-ok-bg px-1.5 py-0.5 font-mono text-3xs font-semibold uppercase tracking-wider text-ok">
            Written
          </span>
          <span className="font-mono text-xs text-text" title={data.dir}>
            {data.dir}
          </span>
        </div>
        <ul className="flex flex-col gap-1 px-3 py-2 font-mono text-xs text-text-2">
          {data.files.map((f) => (
            <li key={f} className="truncate" title={f}>
              {f}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 border-t border-divider bg-sunken px-3 py-2 font-mono text-2xs text-text-3">
          <span>
            Next: <span className="text-text">{data.hint}</span>
          </span>
          {mutatesWorkingTree ? (
            <>
              <div className="flex-1" />
              <Button
                variant="ghost"
                className="h-6 px-2 text-2xs"
                disabled={reindex.isPending}
                onClick={() => reindex.mutate({})}
                title="Re-index to pick up changes made by the agent"
              >
                <RefreshCw
                  size={10}
                  strokeWidth={1.5}
                  className={reindex.isPending ? "animate-spin" : undefined}
                />
                {reindex.isPending ? "Re-indexing…" : "Re-index to refresh"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {data.jobId ? <DispatchLogViewer jobId={data.jobId} harness={harness} mode={mode} /> : null}
    </div>
  );
}
