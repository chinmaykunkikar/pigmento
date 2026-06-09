import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { dispatchJobs } from "@/lib/db/schema";
import { isPidLive } from "@/lib/indexer/run-registry";
import type { DispatchEvent, DispatchJobInput, Harness, RunnableMode } from "./types";

export class JobActiveError extends Error {
  constructor(sourceId: number) {
    super(`a dispatch is already running for source ${sourceId}`);
    this.name = "JobActiveError";
  }
}

type JobStatus = "running" | "done" | "error" | "cancelled";

export type DispatchJob = {
  id: string;
  harness: Harness["name"];
  mode: RunnableMode;
  sourceId: number;
  planId: string;
  startedAt: number;
  endedAt: number | null;
  status: JobStatus;
  events: DispatchEvent[];
  lastEvent: DispatchEvent | null;
};

type JobInternal = DispatchJob & {
  abort: AbortController;
  subscribers: Set<(ev: DispatchEvent) => void>;
  evictAt: number | null;
  drained: Promise<void>;
};

const JOBS_KEY = Symbol.for("pika.dispatchJobs");

type JobsStore = { [k: symbol]: Map<string, JobInternal> | undefined };

function jobsMap(): Map<string, JobInternal> {
  const g = globalThis as unknown as JobsStore;
  let map = g[JOBS_KEY];
  if (!map) {
    map = new Map();
    g[JOBS_KEY] = map;
  }
  return map;
}

const EVICT_AFTER_MS = 5 * 60 * 1000;

let reaperStarted = false;
function ensureReaper() {
  if (reaperStarted) return;
  reaperStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobsMap()) {
      if (job.evictAt !== null && now >= job.evictAt) jobsMap().delete(id);
    }
  }, 30_000).unref();
}

export function startJob(db: Db, harness: Harness, input: DispatchJobInput): DispatchJob {
  ensureReaper();
  reapStaleDispatchJobs(db);

  const id = randomUUID();
  // the row insert IS the concurrency gate: a partial unique index allows one
  // active job per source, so two racing requests cannot both pass
  try {
    db.insert(dispatchJobs)
      .values({
        id,
        sourceId: input.plan.sourceId,
        planId: input.plan.id,
        harness: harness.name,
        mode: input.mode,
        token: id,
        status: "running",
      })
      .run();
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      throw new JobActiveError(input.plan.sourceId);
    }
    throw err;
  }

  const abort = new AbortController();
  const now = Date.now();
  const job: JobInternal = {
    id,
    harness: harness.name,
    mode: input.mode,
    sourceId: input.plan.sourceId,
    planId: input.plan.id,
    startedAt: now,
    endedAt: null,
    status: "running",
    events: [],
    lastEvent: null,
    abort,
    subscribers: new Set(),
    evictAt: null,
    drained: Promise.resolve(),
  };
  jobsMap().set(id, job);
  job.drained = drain(db, job, harness, { ...input, jobToken: id });
  return toPublic(job);
}

export function waitForJob(id: string): Promise<void> {
  const job = jobsMap().get(id);
  return job ? job.drained : Promise.resolve();
}

function finishRow(db: Db, job: JobInternal) {
  const rowStatus =
    job.status === "error" ? "failed" : job.status === "done" ? "done" : "cancelled";
  db.update(dispatchJobs)
    .set({ status: rowStatus, endedAt: new Date().toISOString() })
    .where(eq(dispatchJobs.id, job.id))
    .run();
}

async function drain(db: Db, job: JobInternal, harness: Harness, input: DispatchJobInput) {
  try {
    for await (const ev of harness.run(input, job.abort.signal)) {
      job.events.push(ev);
      job.lastEvent = ev;
      for (const sub of job.subscribers) {
        try {
          sub(ev);
        } catch {
          /* subscriber gone */
        }
      }
      if (ev.type === "spawned") {
        db.update(dispatchJobs)
          .set({ pid: ev.pid, pidStartedAtMs: ev.ts })
          .where(eq(dispatchJobs.id, job.id))
          .run();
      } else if (ev.type === "done") {
        job.status = job.abort.signal.aborted ? "cancelled" : "done";
        job.endedAt = ev.ts;
        job.evictAt = Date.now() + EVICT_AFTER_MS;
        finishRow(db, job);
      } else if (ev.type === "error") {
        job.status = "error";
        job.endedAt = ev.ts;
        job.evictAt = Date.now() + EVICT_AFTER_MS;
        finishRow(db, job);
      }
    }
    if (job.status === "running") {
      // harness stream ended without a terminal event
      job.status = "error";
      job.endedAt = Date.now();
      job.evictAt = Date.now() + EVICT_AFTER_MS;
      finishRow(db, job);
    }
  } catch (err) {
    const ev: DispatchEvent = {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
      ts: Date.now(),
    };
    job.events.push(ev);
    job.lastEvent = ev;
    for (const sub of job.subscribers) {
      try {
        sub(ev);
      } catch {
        /* noop */
      }
    }
    job.status = "error";
    job.endedAt = ev.ts;
    job.evictAt = Date.now() + EVICT_AFTER_MS;
    finishRow(db, job);
  }
}

const ACTIVE_STATUSES = ["pending", "running"] as const;

export function reapStaleDispatchJobs(db: Db, opts: { kill?: (pid: number) => void } = {}): number {
  const kill =
    opts.kill ??
    ((pid: number) => {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    });
  const rows = db
    .select()
    .from(dispatchJobs)
    .where(inArray(dispatchJobs.status, [...ACTIVE_STATUSES]))
    .all();
  let reaped = 0;
  for (const row of rows) {
    if (jobsMap().has(row.id)) continue;
    let status: "orphaned" | "crashed";
    if (row.pid !== null && isPidLive(row.pid, row.pidStartedAtMs ?? 0)) {
      // identity confirmed via pid + start time: this really is our orphaned
      // agent still editing the repo, so stop it
      kill(row.pid);
      status = "orphaned";
    } else {
      status = "crashed";
    }
    db.update(dispatchJobs)
      .set({ status, endedAt: new Date().toISOString() })
      .where(eq(dispatchJobs.id, row.id))
      .run();
    reaped++;
  }
  return reaped;
}

export function getJob(db: Db, id: string): DispatchJob | null {
  const job = jobsMap().get(id);
  if (job) return toPublic(job);
  const row = db.select().from(dispatchJobs).where(eq(dispatchJobs.id, id)).get();
  if (!row) return null;
  return rowToPublic(row);
}

export function cancelJob(db: Db, id: string): boolean {
  const job = jobsMap().get(id);
  if (job) {
    if (job.status !== "running") return true;
    job.abort.abort();
    return true;
  }
  const row = db.select().from(dispatchJobs).where(eq(dispatchJobs.id, id)).get();
  if (!row) return false;
  if (row.status === "pending" || row.status === "running") {
    if (row.pid !== null && isPidLive(row.pid, row.pidStartedAtMs ?? 0)) {
      try {
        process.kill(row.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
    db.update(dispatchJobs)
      .set({ status: "cancelled", endedAt: new Date().toISOString() })
      .where(eq(dispatchJobs.id, id))
      .run();
  }
  return true;
}

export type Unsubscribe = () => void;

export function subscribe(
  id: string,
  cb: (ev: DispatchEvent) => void,
): { unsubscribe: Unsubscribe; buffered: DispatchEvent[]; status: JobStatus } | null {
  const job = jobsMap().get(id);
  if (!job) return null;
  const buffered = [...job.events];
  if (job.status === "running") job.subscribers.add(cb);
  return {
    buffered,
    status: job.status,
    unsubscribe: () => {
      job.subscribers.delete(cb);
    },
  };
}

function toPublic(job: JobInternal): DispatchJob {
  const { abort: _a, subscribers: _s, evictAt: _e, drained: _d, ...rest } = job;
  return { ...rest, events: [...rest.events] };
}

function rowToPublic(row: typeof dispatchJobs.$inferSelect): DispatchJob {
  const statusMap: Record<string, JobStatus> = {
    pending: "running",
    running: "running",
    done: "done",
    failed: "error",
    cancelled: "cancelled",
    orphaned: "error",
    crashed: "error",
  };
  return {
    id: row.id,
    harness: row.harness as Harness["name"],
    mode: row.mode as RunnableMode,
    sourceId: row.sourceId,
    planId: row.planId,
    startedAt: new Date(row.createdAt).getTime(),
    endedAt: row.endedAt ? new Date(row.endedAt).getTime() : null,
    status: statusMap[row.status] ?? "error",
    events: [],
    lastEvent: null,
  };
}
