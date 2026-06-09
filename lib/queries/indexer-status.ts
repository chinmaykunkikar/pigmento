"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { StageEvent } from "@/lib/indexer/events";

export type StageStatus = "pending" | "active" | "done";

export type StageState = {
  key: string;
  label: string;
  status: StageStatus;
  detail: string | null;
  ms: number | null;
};

export type LogEntry = {
  id: number;
  t: number;
  level: "info" | "ok" | "warn";
  text: string;
};

export type IndexerRun = {
  sourceId: number;
  label: string;
  startedAt: number;
  endedAt: number | null;
  totalMs: number | null;
  stages: StageState[];
  log: LogEntry[];
  currentStage: string | null;
  progress: number;
  error: string | null;
};

const PIPELINE: { key: string; label: string }[] = [
  { key: "scan", label: "Walk filesystem" },
  { key: "diff", label: "Filter changes" },
  { key: "hash+meta", label: "Hash + metadata" },
  { key: "upsert", label: "Persist" },
  { key: "delete-missing", label: "Prune missing" },
  { key: "git-author", label: "Git authorship" },
  { key: "usage-scan", label: "Reference graph" },
  { key: "cluster", label: "Clustering" },
  { key: "fts", label: "Search index" },
];

const LOG_MAX = 14;
const CLEAR_AFTER_END_MS = 1200;
const CLEAR_AFTER_ERROR_MS = 6000;

function initialStages(): StageState[] {
  return PIPELINE.map((p) => ({
    key: p.key,
    label: p.label,
    status: "pending" as const,
    detail: null,
    ms: null,
  }));
}

function computeProgress(stages: StageState[]): number {
  const total = stages.length;
  if (total === 0) return 0;
  const done = stages.filter((s) => s.status === "done").length;
  const active = stages.some((s) => s.status === "active") ? 0.5 : 0;
  return Math.min(100, Math.round(((done + active) / total) * 100));
}

export function useIndexerStatus(): IndexerRun | null {
  const [run, setRun] = useState<IndexerRun | null>(null);
  const logIdRef = useRef(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const source = new EventSource("/api/status");

    const pushLog = (prev: IndexerRun, level: LogEntry["level"], text: string): LogEntry[] => {
      logIdRef.current += 1;
      const entry: LogEntry = { id: logIdRef.current, t: Date.now(), level, text };
      const next = [...prev.log, entry];
      return next.length > LOG_MAX ? next.slice(next.length - LOG_MAX) : next;
    };

    const handleEvent = (ev: StageEvent) => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      if (ev.type === "run-start") {
        setRun({
          sourceId: ev.sourceId,
          label: ev.label,
          startedAt: Date.now(),
          endedAt: null,
          totalMs: null,
          stages: initialStages(),
          log: [],
          currentStage: null,
          progress: 0,
          error: null,
        });
        return;
      }

      if (ev.type === "stage-start") {
        setRun((prev) => {
          if (!prev) return prev;
          const stages = prev.stages.map((s): StageState => {
            if (s.key !== ev.stage) return s;
            return { ...s, status: "active", detail: null };
          });
          const existed = prev.stages.some((s) => s.key === ev.stage);
          const finalStages = existed
            ? stages
            : [
                ...stages,
                {
                  key: ev.stage,
                  label: ev.stage,
                  status: "active" as const,
                  detail: null,
                  ms: null,
                },
              ];
          return {
            ...prev,
            stages: finalStages,
            currentStage: ev.stage,
            progress: computeProgress(finalStages),
            log: pushLog(prev, "info", `[${ev.stage}] starting…`),
          };
        });
        return;
      }

      if (ev.type === "stage-end") {
        setRun((prev) => {
          if (!prev) return prev;
          const stages = prev.stages.map((s): StageState => {
            if (s.key !== ev.stage) return s;
            return { ...s, status: "done", detail: ev.detail, ms: ev.ms };
          });
          return {
            ...prev,
            stages,
            progress: computeProgress(stages),
            log: pushLog(prev, "ok", `[${ev.stage}] ${ev.detail} · ${fmtMs(ev.ms)}`),
          };
        });
        return;
      }

      if (ev.type === "run-end") {
        // data only changes when the indexer writes, so refetch everything now
        qc.invalidateQueries();
        setRun((prev) => {
          if (!prev) return prev;
          const stages = prev.stages.map(
            (s): StageState => (s.status === "active" ? { ...s, status: "done" } : s),
          );
          return {
            ...prev,
            stages,
            endedAt: Date.now(),
            totalMs: ev.ms,
            currentStage: null,
            progress: 100,
            log: pushLog(prev, "ok", `done · ${fmtMs(ev.ms)}`),
          };
        });
        clearTimerRef.current = setTimeout(() => {
          setRun(null);
        }, CLEAR_AFTER_END_MS);
        return;
      }

      if (ev.type === "run-error") {
        qc.invalidateQueries();
        setRun((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            endedAt: Date.now(),
            totalMs: ev.ms,
            currentStage: null,
            error: ev.error,
            log: pushLog(prev, "warn", `run failed: ${ev.error}`),
          };
        });
        clearTimerRef.current = setTimeout(() => {
          setRun(null);
        }, CLEAR_AFTER_ERROR_MS);
      }
    };

    source.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as StageEvent;
        handleEvent(parsed);
      } catch {
        /* ignore parse errors */
      }
    };

    source.onerror = () => {
      /* browser auto-reconnects; nothing to do */
    };

    return () => {
      source.close();
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [qc]);

  return run;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
