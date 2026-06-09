import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@/lib/config/schema";
import * as schema from "@/lib/db/schema";
import { FailureLog } from "@/lib/indexer/attempt";
import { indexerEvents, type StageEvent } from "@/lib/indexer/events";
import { runIndexer, startIndexerRun } from "@/lib/indexer/run";
import {
  acquireRun,
  completeRun,
  isRunActive,
  ownPidStartMs,
  RunActiveError,
  reapStaleRuns,
} from "@/lib/indexer/run-registry";
import { createTestDb, seedSource, type TestDb } from "./helpers/test-db";

const FIXTURES = resolve(import.meta.dirname, "fixtures/svg");
const DEAD_PID = 4_000_000;

const config = ConfigSchema.parse({ codeRoots: [], clip: { enabled: false } });

let cleanups: (() => void)[] = [];

afterEach(() => {
  for (const fn of cleanups) fn();
  cleanups = [];
});

function makeDb(): TestDb {
  const t = createTestDb();
  cleanups.push(t.cleanup);
  return t;
}

function makeSourceDir(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "pika-src-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  for (const f of files) copyFileSync(join(FIXTURES, f), join(dir, f));
  return dir;
}

describe("FailureLog", () => {
  it("captures reasons and returns null instead of throwing", async () => {
    const log = new FailureLog();
    const ok = await log.attempt("read", "a.svg", () => 42);
    const bad = await log.attempt("read", "b.svg", () => {
      throw new Error("ENOENT: no such file");
    });
    expect(ok).toBe(42);
    expect(bad).toBeNull();
    expect(log.size).toBe(1);
    expect(log.failures[0]).toEqual({
      label: "read",
      file: "b.svg",
      reason: "ENOENT: no such file",
    });
    expect(log.summary()).toContain("1 failed");
  });
});

describe("run registry", () => {
  it("refuses a second run while one is active in a live process", () => {
    const t = makeDb();
    const sourceId = seedSource(t.db).id;
    const runId = acquireRun(t.db, sourceId);
    expect(isRunActive(t.db, sourceId)).toBe(true);
    expect(() => acquireRun(t.db, sourceId)).toThrow(RunActiveError);
    completeRun(t.db, runId, "done");
    expect(isRunActive(t.db, sourceId)).toBe(false);
  });

  it("reaps a stale running row left by a dead process", () => {
    const t = makeDb();
    const sourceId = seedSource(t.db).id;
    t.db
      .insert(schema.indexRuns)
      .values({ sourceId, pid: DEAD_PID, pidStartedAtMs: 0, status: "running" })
      .run();

    const runId = acquireRun(t.db, sourceId);
    expect(runId).toBeGreaterThan(0);

    const rows = t.db.select().from(schema.indexRuns).all();
    const crashed = rows.find((r) => r.pid === DEAD_PID);
    expect(crashed?.status).toBe("crashed");
    completeRun(t.db, runId, "done");
  });

  it("reapStaleRuns counts only dead-process rows", () => {
    const t = makeDb();
    const sourceId = seedSource(t.db).id;
    const other = seedSource(t.db, "/tmp/pika-other").id;
    t.db
      .insert(schema.indexRuns)
      .values({ sourceId, pid: DEAD_PID, pidStartedAtMs: 0, status: "running" })
      .run();
    t.db
      .insert(schema.indexRuns)
      .values({
        sourceId: other,
        pid: process.pid,
        pidStartedAtMs: ownPidStartMs(),
        status: "running",
      })
      .run();
    expect(reapStaleRuns(t.db)).toBe(1);
  });
});

describe("runIndexer lifecycle", () => {
  it("indexes, keeps row ids stable across full runs, and prunes deletions without a purge window", async () => {
    const t = makeDb();
    const dir = makeSourceDir(["house.svg", "house-variant.svg"]);
    const source = seedSource(t.db, dir);

    await runIndexer({ db: t.db, source, config, full: true });
    const first = t.db.select().from(schema.assets).all();
    expect(first).toHaveLength(2);
    expect(first.every((r) => r.phashPopcount !== null)).toBe(true);

    await runIndexer({ db: t.db, source, config, full: true });
    const second = t.db.select().from(schema.assets).all();
    expect(second.map((r) => r.id).sort()).toEqual(first.map((r) => r.id).sort());

    rmSync(join(dir, "house-variant.svg"));
    await runIndexer({ db: t.db, source, config, full: true });
    const third = t.db.select().from(schema.assets).all();
    expect(third).toHaveLength(1);
    expect(third[0]?.name).toBe("house.svg");
    expect(third[0]?.id).toBe(first.find((r) => r.name === "house.svg")?.id);

    const runs = t.db.select().from(schema.indexRuns).all();
    expect(runs).toHaveLength(3);
    expect(runs.every((r) => r.status === "done")).toBe(true);
  });

  it("refuses to start while another run holds the sentinel", () => {
    const t = makeDb();
    const dir = makeSourceDir(["house.svg"]);
    const source = seedSource(t.db, dir);
    t.db
      .insert(schema.indexRuns)
      .values({
        sourceId: source.id,
        pid: process.pid,
        pidStartedAtMs: ownPidStartMs(),
        status: "running",
      })
      .run();
    expect(() => startIndexerRun({ db: t.db, source, config, full: false })).toThrow(
      RunActiveError,
    );
  });

  it("aborts when the source root vanished instead of pruning every row", async () => {
    const t = makeDb();
    const dir = makeSourceDir(["house.svg"]);
    const source = seedSource(t.db, dir);

    await runIndexer({ db: t.db, source, config, full: true });
    expect(t.db.select().from(schema.assets).all()).toHaveLength(1);

    rmSync(dir, { recursive: true, force: true });
    await expect(runIndexer({ db: t.db, source, config, full: true })).rejects.toThrow(
      /missing or not a directory/,
    );

    expect(t.db.select().from(schema.assets).all()).toHaveLength(1);
    const errored = t.db
      .select()
      .from(schema.indexRuns)
      .where(eq(schema.indexRuns.status, "error"))
      .all();
    expect(errored).toHaveLength(1);
  });

  it("degrades per-file on corrupt input and surfaces failure reasons in stage events", async () => {
    const t = makeDb();
    const dir = makeSourceDir(["house.svg"]);
    writeFileSync(join(dir, "garbage.svg"), "this is not an svg at all");
    const source = seedSource(t.db, dir);

    const events: StageEvent[] = [];
    const listener = (ev: StageEvent) => events.push(ev);
    indexerEvents().on("event", listener);
    cleanups.push(() => indexerEvents().off("event", listener));

    await runIndexer({ db: t.db, source, config, full: true });

    const rows = t.db.select().from(schema.assets).all();
    expect(rows).toHaveLength(2);
    const garbage = rows.find((r) => r.name === "garbage.svg");
    expect(garbage).toBeDefined();
    expect(garbage?.phash).toBeNull();

    const hashStage = events.find(
      (e) => e.type === "stage-end" && e.stage === "hash+meta" && e.failures,
    );
    expect(hashStage).toBeDefined();
    if (hashStage?.type === "stage-end") {
      expect(hashStage.failures?.some((f) => f.file === "garbage.svg")).toBe(true);
      expect(hashStage.detail).toContain("failed");
    }
  });
});
