"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { DispatchEvent, DispatchHarness, DispatchMode } from "@/lib/queries/dispatch";
import { useDispatchStream } from "@/lib/queries/dispatch";
import { Button } from "../primitives/Button";

type Props = {
  jobId: string;
  harness: DispatchHarness;
  mode: DispatchMode;
};

export function DispatchLogViewer({ jobId, harness, mode }: Props) {
  const stream = useDispatchStream(jobId);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stream.status === "done" || stream.status === "error" || stream.status === "cancelled") {
      return;
    }
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [stream.status]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on each appended event
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [stream.events.length]);

  const pill = statusPill(stream.status);
  const running = stream.status === "running" || stream.status === "connecting";

  return (
    <div className="animate-[slide-down-in_260ms_var(--ease-out-quart)] flex flex-col overflow-hidden rounded-sm border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
        <span
          className={cn(
            "rounded-xs px-1.5 py-0.5 font-mono text-3xs font-semibold uppercase tracking-wider",
            pill.cls,
          )}
        >
          {pill.label}
        </span>
        <span className="font-mono text-xs text-text">{harness}</span>
        <span className="font-mono text-xs text-text-3">·</span>
        <span className="font-mono text-xs text-text-2">{mode}</span>
        <div className="flex-1" />
        <span className="font-mono text-2xs tabular-nums text-text-3">
          {formatElapsed(elapsed)}
        </span>
        {running ? (
          <Button variant="ghost" onClick={stream.cancel} className="h-6 px-2 text-2xs">
            Cancel
          </Button>
        ) : null}
      </div>

      <div
        ref={bodyRef}
        className="max-h-75 overflow-auto bg-sunken px-3 py-2 font-mono text-2xs leading-relaxed"
      >
        {stream.events.length === 0 ? (
          <p className="text-text-3">Waiting for output…</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {stream.events.map((ev) => (
              <li key={ev.k} className={cn("whitespace-pre-wrap break-words", lineClass(ev))}>
                {renderLine(ev)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DispatchFooter state={stream} />
    </div>
  );
}

function DispatchFooter({ state }: { state: ReturnType<typeof useDispatchStream> }) {
  if (state.status === "done") {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-divider bg-surface px-3 py-2 font-mono text-2xs text-text-3">
        <span>exit</span>
        <span className="tabular-nums text-text">{state.exitCode ?? "-"}</span>
        {state.branch ? (
          <>
            <span className="text-text-4">·</span>
            <span>branch</span>
            <span className="text-text">{state.branch}</span>
          </>
        ) : null}
        {state.prUrl ? (
          <>
            <span className="text-text-4">·</span>
            <a
              href={state.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline-offset-2 hover:underline"
            >
              {state.prUrl}
            </a>
          </>
        ) : null}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="border-t border-divider bg-danger-bg px-3 py-2 font-mono text-2xs text-danger">
        {state.error ?? "dispatch failed"}
      </div>
    );
  }
  if (state.status === "cancelled") {
    return (
      <div className="border-t border-divider bg-warn-bg px-3 py-2 font-mono text-2xs text-warn">
        cancelled
      </div>
    );
  }
  return null;
}

function statusPill(status: string): { label: string; cls: string } {
  if (status === "running" || status === "connecting") {
    return { label: "Running", cls: "bg-accent-bg text-accent-text" };
  }
  if (status === "done") return { label: "Done", cls: "bg-ok-bg text-ok" };
  if (status === "error") return { label: "Error", cls: "bg-danger-bg text-danger" };
  if (status === "cancelled") return { label: "Cancelled", cls: "bg-warn-bg text-warn" };
  return { label: "Idle", cls: "bg-sunken-2 text-text-3" };
}

function lineClass(ev: DispatchEvent): string {
  if (ev.type === "stderr") return "text-danger";
  if (ev.type === "info") return "text-text-3";
  if (ev.type === "error") return "text-danger";
  if (ev.type === "done") return "text-ok";
  return "text-text-2";
}

function renderLine(ev: DispatchEvent): string {
  if (ev.type === "done") return `• exit ${ev.exitCode}`;
  if (ev.type === "error") return `✗ ${ev.message}`;
  if ("line" in ev) return ev.line;
  return "";
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
