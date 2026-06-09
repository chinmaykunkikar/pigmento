import { execFileSync } from "node:child_process";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { indexRuns } from "../db/schema";

export class RunActiveError extends Error {
  constructor(sourceId: number) {
    super(`an index run is already active for source ${sourceId}`);
    this.name = "RunActiveError";
  }
}

const PID_START_TOLERANCE_MS = 5000;

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pidStartMs(pid: number): number | null {
  try {
    const out = execFileSync("ps", ["-p", String(pid), "-o", "lstart="], {
      encoding: "utf8",
    }).trim();
    if (!out) return null;
    const t = new Date(out).getTime();
    return Number.isNaN(t) ? null : t;
  } catch {
    return null;
  }
}

// identity is pid + process start time, so a reused pid never counts as live
function isLive(pid: number, storedStartMs: number): boolean {
  if (!pidAlive(pid)) return false;
  const start = pidStartMs(pid);
  if (start === null) return true;
  return Math.abs(start - storedStartMs) <= PID_START_TOLERANCE_MS;
}

export function ownPidStartMs(): number {
  return Math.round(performance.timeOrigin);
}

export function reapStaleRuns(db: Db, sourceId?: number): number {
  const rows =
    sourceId === undefined
      ? db.select().from(indexRuns).where(eq(indexRuns.status, "running")).all()
      : db
          .select()
          .from(indexRuns)
          .where(and(eq(indexRuns.status, "running"), eq(indexRuns.sourceId, sourceId)))
          .all();
  let reaped = 0;
  for (const row of rows) {
    if (isLive(row.pid, row.pidStartedAtMs)) continue;
    db.update(indexRuns)
      .set({ status: "crashed", endedAt: new Date().toISOString() })
      .where(eq(indexRuns.id, row.id))
      .run();
    reaped++;
  }
  return reaped;
}

export function acquireRun(db: Db, sourceId: number): number {
  reapStaleRuns(db, sourceId);
  try {
    const [row] = db
      .insert(indexRuns)
      .values({
        sourceId,
        pid: process.pid,
        pidStartedAtMs: ownPidStartMs(),
        status: "running",
      })
      .returning()
      .all();
    if (!row) throw new Error("failed to record index run");
    return row.id;
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      throw new RunActiveError(sourceId);
    }
    throw err;
  }
}

export function completeRun(db: Db, runId: number, status: "done" | "error", error?: string): void {
  db.update(indexRuns)
    .set({ status, error: error ?? null, endedAt: new Date().toISOString() })
    .where(eq(indexRuns.id, runId))
    .run();
}

export function isRunActive(db: Db, sourceId: number): boolean {
  reapStaleRuns(db, sourceId);
  const row = db
    .select({ id: indexRuns.id })
    .from(indexRuns)
    .where(and(eq(indexRuns.status, "running"), eq(indexRuns.sourceId, sourceId)))
    .get();
  return row !== undefined;
}
