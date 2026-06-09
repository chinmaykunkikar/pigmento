import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { ownPidStartMs } from "@/lib/indexer/run-registry";
import {
  cancelJob,
  getJob,
  JobActiveError,
  reapStaleDispatchJobs,
  startJob,
  waitForJob,
} from "@/lib/plan/dispatch/jobs";
import type { DispatchEvent, DispatchJobInput, Harness } from "@/lib/plan/dispatch/types";
import type { Plan } from "@/lib/plan/schema";
import { createTestDb, seedSource, type TestDb } from "./helpers/test-db";

const DEAD_PID = 4_000_000;

function makePlan(sourceId: number, id = "plan-test"): Plan {
  return {
    version: "pika/plan v1",
    id,
    name: "test plan",
    sourceId,
    sourceLabel: "fixture",
    createdAt: 1,
    updatedAt: 1,
    actions: [],
  };
}

function makeInput(sourceId: number, planId?: string): DispatchJobInput {
  return { plan: makePlan(sourceId, planId), mode: "patch", cwd: "/tmp", planDir: "/tmp" };
}

function scriptedHarness(events: DispatchEvent[]): Harness {
  return {
    name: "claude-code",
    isReady: async () => ({ ready: true }),
    // biome-ignore lint/correctness/useYield: generator yields from array
    run: async function* () {
      for (const ev of events) yield ev;
    },
  };
}

function hangingHarness(release: Promise<void>): Harness {
  return {
    name: "claude-code",
    isReady: async () => ({ ready: true }),
    run: async function* () {
      await release;
      yield { type: "done", exitCode: 0, ts: Date.now() } satisfies DispatchEvent;
    },
  };
}

let t: TestDb;
let sourceId: number;

beforeEach(() => {
  t = createTestDb();
  sourceId = seedSource(t.db).id;
});

afterEach(() => {
  t.cleanup();
});

describe("dispatch job persistence", () => {
  it("persists the job row, records the agent pid, and settles to done", async () => {
    const harness = scriptedHarness([
      { type: "spawned", pid: DEAD_PID, line: "• agent pid", ts: 123_456 },
      { type: "stdout", line: "working", ts: 2 },
      { type: "done", exitCode: 0, ts: 3 },
    ]);
    const job = startJob(t.db, harness, makeInput(sourceId));
    await waitForJob(job.id);

    const row = t.db
      .select()
      .from(schema.dispatchJobs)
      .where(eq(schema.dispatchJobs.id, job.id))
      .get();
    expect(row?.status).toBe("done");
    expect(row?.pid).toBe(DEAD_PID);
    expect(row?.pidStartedAtMs).toBe(123_456);
    expect(row?.endedAt).toBeTruthy();
    expect(row?.token).toBe(job.id);
  });

  it("rejects a concurrent dispatch for the same source via the SQL gate", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const first = startJob(t.db, hangingHarness(gate), makeInput(sourceId, "plan-a"));
    expect(() => startJob(t.db, scriptedHarness([]), makeInput(sourceId, "plan-b"))).toThrow(
      JobActiveError,
    );
    release();
    await waitForJob(first.id);
  });

  it("marks the row failed when the harness errors", async () => {
    const harness = scriptedHarness([{ type: "error", message: "boom", ts: 1 }]);
    const job = startJob(t.db, harness, makeInput(sourceId));
    await waitForJob(job.id);
    const row = t.db
      .select()
      .from(schema.dispatchJobs)
      .where(eq(schema.dispatchJobs.id, job.id))
      .get();
    expect(row?.status).toBe("failed");
  });
});

describe("orphan reaping", () => {
  it("marks dead-pid rows crashed without killing anything", () => {
    t.db
      .insert(schema.dispatchJobs)
      .values({
        id: "stale-dead",
        sourceId,
        planId: "p",
        harness: "claude-code",
        mode: "patch",
        pid: DEAD_PID,
        pidStartedAtMs: 0,
        token: "tok",
        status: "running",
      })
      .run();
    const kill = vi.fn();
    expect(reapStaleDispatchJobs(t.db, { kill })).toBe(1);
    expect(kill).not.toHaveBeenCalled();
    const row = t.db
      .select()
      .from(schema.dispatchJobs)
      .where(eq(schema.dispatchJobs.id, "stale-dead"))
      .get();
    expect(row?.status).toBe("crashed");
  });

  it("kills identity-confirmed live orphans and marks them orphaned", () => {
    t.db
      .insert(schema.dispatchJobs)
      .values({
        id: "stale-alive",
        sourceId,
        planId: "p",
        harness: "claude-code",
        mode: "patch",
        pid: process.pid,
        pidStartedAtMs: ownPidStartMs(),
        token: "tok",
        status: "running",
      })
      .run();
    const kill = vi.fn();
    expect(reapStaleDispatchJobs(t.db, { kill })).toBe(1);
    expect(kill).toHaveBeenCalledWith(process.pid);
    const row = t.db
      .select()
      .from(schema.dispatchJobs)
      .where(eq(schema.dispatchJobs.id, "stale-alive"))
      .get();
    expect(row?.status).toBe("orphaned");
  });
});

describe("post-restart job access", () => {
  it("getJob falls back to the persisted row", () => {
    t.db
      .insert(schema.dispatchJobs)
      .values({
        id: "row-only",
        sourceId,
        planId: "p",
        harness: "claude-code",
        mode: "open-pr",
        token: "tok",
        status: "failed",
        endedAt: new Date().toISOString(),
      })
      .run();
    const job = getJob(t.db, "row-only");
    expect(job?.status).toBe("error");
    expect(job?.mode).toBe("open-pr");
  });

  it("cancelJob settles a row-only active job", () => {
    t.db
      .insert(schema.dispatchJobs)
      .values({
        id: "row-active",
        sourceId,
        planId: "p",
        harness: "claude-code",
        mode: "patch",
        pid: DEAD_PID,
        pidStartedAtMs: 0,
        token: "tok",
        status: "running",
      })
      .run();
    expect(cancelJob(t.db, "row-active")).toBe(true);
    const row = t.db
      .select()
      .from(schema.dispatchJobs)
      .where(eq(schema.dispatchJobs.id, "row-active"))
      .get();
    expect(row?.status).toBe("cancelled");
    expect(cancelJob(t.db, "missing")).toBe(false);
  });
});
