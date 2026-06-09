import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema } from "@/lib/config/schema";
import * as schema from "@/lib/db/schema";
import { indexerEvents, type StageEvent } from "@/lib/indexer/events";
import { runIndexer } from "@/lib/indexer/run";
import { createTestDb, seedSource, type TestDb } from "./helpers/test-db";

vi.mock("@/lib/indexer/fts", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/indexer/fts")>();
  return {
    ...orig,
    rebuildFts: vi.fn(() => {
      throw new Error("fts boom");
    }),
  };
});

const FIXTURES = resolve(import.meta.dirname, "fixtures/svg");
const config = ConfigSchema.parse({ codeRoots: [], clip: { enabled: false } });

let cleanups: (() => void)[] = [];

afterEach(() => {
  for (const fn of cleanups) fn();
  cleanups = [];
});

describe("crash mid-run", () => {
  it("leaves the indexed data readable, records the error, and emits run-error", async () => {
    const t: TestDb = createTestDb();
    cleanups.push(t.cleanup);
    const dir = mkdtempSync(join(tmpdir(), "pika-crash-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    copyFileSync(join(FIXTURES, "house.svg"), join(dir, "house.svg"));
    const source = seedSource(t.db, dir);

    const events: StageEvent[] = [];
    const listener = (ev: StageEvent) => events.push(ev);
    indexerEvents().on("event", listener);
    cleanups.push(() => indexerEvents().off("event", listener));

    await expect(runIndexer({ db: t.db, source, config, full: true })).rejects.toThrow("fts boom");

    // everything persisted before the crashing stage is still readable
    const rows = t.db.select().from(schema.assets).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("house.svg");

    const run = t.db
      .select()
      .from(schema.indexRuns)
      .where(eq(schema.indexRuns.sourceId, source.id))
      .get();
    expect(run?.status).toBe("error");
    expect(run?.error).toBe("fts boom");
    expect(run?.endedAt).toBeTruthy();

    const runError = events.find((e) => e.type === "run-error");
    expect(runError).toBeDefined();
    if (runError?.type === "run-error") {
      expect(runError.error).toBe("fts boom");
    }
  });
});
