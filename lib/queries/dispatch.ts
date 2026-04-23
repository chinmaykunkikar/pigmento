"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Plan } from "@/lib/plan/schema";
import { apiPost } from "./client";

export type DispatchMode = "dry-run" | "patch" | "open-pr";
export type DispatchHarness = "claude-code" | "devin" | "codex-cli";

export type DispatchEvent =
  | { type: "stdout"; line: string; ts: number }
  | { type: "stderr"; line: string; ts: number }
  | { type: "info"; line: string; ts: number }
  | { type: "done"; exitCode: number; branch?: string; prUrl?: string; ts: number }
  | { type: "error"; message: string; ts: number };

export type KeyedDispatchEvent = DispatchEvent & { k: number };

export type DispatchResult = {
  jobId: string | null;
  dir: string;
  files: string[];
  hint: string;
};

type Input = { plan: Plan; mode: DispatchMode; harness: DispatchHarness };

export function useDispatchPlan() {
  return useMutation<DispatchResult, Error, Input>({
    mutationFn: (input) => apiPost<DispatchResult, Input>("/api/plans/dispatch", input),
  });
}

export type StreamStatus = "idle" | "connecting" | "running" | "done" | "error" | "cancelled";

export type StreamState = {
  status: StreamStatus;
  events: KeyedDispatchEvent[];
  exitCode: number | null;
  branch: string | null;
  prUrl: string | null;
  error: string | null;
};

const initialState: StreamState = {
  status: "idle",
  events: [],
  exitCode: null,
  branch: null,
  prUrl: null,
  error: null,
};

export function useDispatchStream(jobId: string | null): StreamState & { cancel: () => void } {
  const [state, setState] = useState<StreamState>(initialState);
  const sourceRef = useRef<EventSource | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    if (!jobId) {
      setState(initialState);
      return;
    }
    keyRef.current = 0;
    setState({ ...initialState, status: "connecting" });

    const src = new EventSource(`/api/plans/dispatch/${jobId}/stream`);
    sourceRef.current = src;

    src.onopen = () => {
      setState((s) => (s.status === "connecting" ? { ...s, status: "running" } : s));
    };

    src.onmessage = (msg) => {
      let ev: DispatchEvent;
      try {
        ev = JSON.parse(msg.data) as DispatchEvent;
      } catch {
        return;
      }
      keyRef.current += 1;
      const keyed: KeyedDispatchEvent = { ...ev, k: keyRef.current };
      setState((s) => {
        const events = [...s.events, keyed];
        if (ev.type === "done") {
          src.close();
          return {
            ...s,
            events,
            status: "done",
            exitCode: ev.exitCode,
            branch: ev.branch ?? null,
            prUrl: ev.prUrl ?? null,
          };
        }
        if (ev.type === "error") {
          src.close();
          return { ...s, events, status: "error", error: ev.message };
        }
        return { ...s, events, status: "running" };
      });
    };

    src.onerror = () => {
      setState((s) => {
        if (s.status === "done" || s.status === "error" || s.status === "cancelled") return s;
        src.close();
        return { ...s, status: "error", error: "stream connection lost" };
      });
    };

    return () => {
      src.close();
      sourceRef.current = null;
    };
  }, [jobId]);

  const cancel = () => {
    if (!jobId) return;
    void fetch(`/api/plans/dispatch/${jobId}`, { method: "DELETE" }).catch(() => {});
    setState((s) => (s.status === "running" ? { ...s, status: "cancelled" } : s));
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
  };

  return { ...state, cancel };
}
