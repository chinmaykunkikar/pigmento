import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { backfillPhashPopcount } from "@/lib/indexer/hygiene";
import { createTestDb, seedAsset, seedSource, type TestDb } from "./helpers/test-db";

let t: TestDb;
let sourceId: number;

beforeEach(() => {
  t = createTestDb();
  sourceId = seedSource(t.db).id;
});

afterEach(() => {
  t.cleanup();
});

describe("signal-hygiene columns", () => {
  it("round-trips popcount, white fraction, and embed status", () => {
    const asset = seedAsset(t.db, sourceId, {
      name: "icon.svg",
      phash: "0f0f0f0f0f0f0f0f",
      phashPopcount: 32,
      rasterWhiteFraction: 0.42,
      embedStatus: "ok",
    });
    const row = t.db.select().from(schema.assets).where(eq(schema.assets.id, asset.id)).get();
    expect(row?.phashPopcount).toBe(32);
    expect(row?.rasterWhiteFraction).toBeCloseTo(0.42);
    expect(row?.embedStatus).toBe("ok");
  });

  it("backfills popcount for rows indexed before the column existed", () => {
    seedAsset(t.db, sourceId, { name: "a.svg", phash: "0f0f0f0f0f0f0f0f" });
    seedAsset(t.db, sourceId, { name: "b.svg", phash: "0000000000000003" });
    seedAsset(t.db, sourceId, { name: "c.svg" });

    const updated = backfillPhashPopcount(t.db, sourceId);
    expect(updated).toBe(2);

    const rows = t.db.select().from(schema.assets).all();
    const byName = new Map(rows.map((r) => [r.name, r]));
    expect(byName.get("a.svg")?.phashPopcount).toBe(32);
    expect(byName.get("b.svg")?.phashPopcount).toBe(2);
    expect(byName.get("c.svg")?.phashPopcount).toBeNull();

    expect(backfillPhashPopcount(t.db, sourceId)).toBe(0);
  });
});

describe("index_runs sentinel", () => {
  it("allows only one running row per source", () => {
    t.db
      .insert(schema.indexRuns)
      .values({ sourceId, pid: 100, pidStartedAtMs: 1, status: "running" })
      .run();
    expect(() =>
      t.db
        .insert(schema.indexRuns)
        .values({ sourceId, pid: 200, pidStartedAtMs: 2, status: "running" })
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it("allows a new run once the previous one finished", () => {
    t.db
      .insert(schema.indexRuns)
      .values({ sourceId, pid: 100, pidStartedAtMs: 1, status: "done" })
      .run();
    t.db
      .insert(schema.indexRuns)
      .values({ sourceId, pid: 200, pidStartedAtMs: 2, status: "running" })
      .run();
    const rows = t.db.select().from(schema.indexRuns).all();
    expect(rows).toHaveLength(2);
  });

  it("allows concurrent runs on different sources", () => {
    const other = seedSource(t.db, "/tmp/pika-other-source").id;
    t.db
      .insert(schema.indexRuns)
      .values({ sourceId, pid: 100, pidStartedAtMs: 1, status: "running" })
      .run();
    t.db
      .insert(schema.indexRuns)
      .values({ sourceId: other, pid: 200, pidStartedAtMs: 2, status: "running" })
      .run();
    const rows = t.db.select().from(schema.indexRuns).all();
    expect(rows).toHaveLength(2);
  });
});

describe("dispatch_jobs registry", () => {
  it("enforces one active job per source across pending and running", () => {
    t.db
      .insert(schema.dispatchJobs)
      .values({
        id: "job-1",
        sourceId,
        planId: "plan-a",
        harness: "claude-code",
        mode: "patch",
        token: "tok-1",
        status: "pending",
      })
      .run();
    expect(() =>
      t.db
        .insert(schema.dispatchJobs)
        .values({
          id: "job-2",
          sourceId,
          planId: "plan-b",
          harness: "claude-code",
          mode: "patch",
          token: "tok-2",
          status: "running",
        })
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it("allows a new job after the previous one ended", () => {
    t.db
      .insert(schema.dispatchJobs)
      .values({
        id: "job-1",
        sourceId,
        planId: "plan-a",
        harness: "claude-code",
        mode: "patch",
        token: "tok-1",
        status: "done",
      })
      .run();
    t.db
      .insert(schema.dispatchJobs)
      .values({
        id: "job-2",
        sourceId,
        planId: "plan-b",
        harness: "claude-code",
        mode: "open-pr",
        token: "tok-2",
        status: "running",
      })
      .run();
    const rows = t.db.select().from(schema.dispatchJobs).all();
    expect(rows).toHaveLength(2);
  });
});
