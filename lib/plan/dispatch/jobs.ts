import type { DispatchEvent, DispatchJobInput, Harness, RunnableMode } from "./types";

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
};

const JOBS = new Map<string, JobInternal>();
const EVICT_AFTER_MS = 5 * 60 * 1000;

let reaperStarted = false;
function ensureReaper() {
  if (reaperStarted) return;
  reaperStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of JOBS) {
      if (job.evictAt !== null && now >= job.evictAt) JOBS.delete(id);
    }
  }, 30_000).unref();
}

export function startJob(harness: Harness, input: DispatchJobInput): DispatchJob {
  ensureReaper();
  const id = crypto.randomUUID();
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
  };
  JOBS.set(id, job);

  void drain(job, harness, input);
  return toPublic(job);
}

async function drain(job: JobInternal, harness: Harness, input: DispatchJobInput) {
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
      if (ev.type === "done") {
        job.status = job.abort.signal.aborted ? "cancelled" : "done";
        job.endedAt = ev.ts;
        job.evictAt = Date.now() + EVICT_AFTER_MS;
      } else if (ev.type === "error") {
        job.status = "error";
        job.endedAt = ev.ts;
        job.evictAt = Date.now() + EVICT_AFTER_MS;
      }
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
  }
}

export function getJob(id: string): DispatchJob | null {
  const job = JOBS.get(id);
  return job ? toPublic(job) : null;
}

export function listRunningForSource(sourceId: number): DispatchJob[] {
  const running: DispatchJob[] = [];
  for (const job of JOBS.values()) {
    if (job.sourceId === sourceId && job.status === "running") running.push(toPublic(job));
  }
  return running;
}

export function cancelJob(id: string): boolean {
  const job = JOBS.get(id);
  if (!job) return false;
  if (job.status !== "running") return true;
  job.abort.abort();
  return true;
}

export type Unsubscribe = () => void;

export function subscribe(
  id: string,
  cb: (ev: DispatchEvent) => void,
): { unsubscribe: Unsubscribe; buffered: DispatchEvent[]; status: JobStatus } | null {
  const job = JOBS.get(id);
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
  const { abort: _a, subscribers: _s, evictAt: _e, ...rest } = job;
  return { ...rest, events: [...rest.events] };
}
