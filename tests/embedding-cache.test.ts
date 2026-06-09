import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitStage } from "@/lib/indexer/events";
import {
  clipHealth,
  getEmbeddingCandidates,
  invalidateEmbeddingCache,
} from "@/lib/match/embedding-cache";
import { createTestDb, seedAsset, seedSource, type TestDb } from "./helpers/test-db";

let t: TestDb;
let sourceId: number;

beforeEach(() => {
  t = createTestDb();
  sourceId = seedSource(t.db).id;
  invalidateEmbeddingCache();
});

afterEach(() => {
  invalidateEmbeddingCache();
  t.cleanup();
});

const vec = () => new Float32Array([1, 0, 0, 0]);

describe("embedding cache", () => {
  it("serves cached candidates until invalidated", () => {
    seedAsset(t.db, sourceId, { name: "a.svg", clipEmbedding: vec(), embedStatus: "ok" });
    const first = getEmbeddingCandidates(t.db, sourceId);
    expect(first).toHaveLength(1);

    seedAsset(t.db, sourceId, { name: "b.svg", clipEmbedding: vec(), embedStatus: "ok" });
    expect(getEmbeddingCandidates(t.db, sourceId)).toHaveLength(1);
    expect(getEmbeddingCandidates(t.db, sourceId)).toBe(first);

    invalidateEmbeddingCache(sourceId);
    expect(getEmbeddingCandidates(t.db, sourceId)).toHaveLength(2);
  });

  it("invalidates on run-end and run-error events", () => {
    seedAsset(t.db, sourceId, { name: "a.svg", clipEmbedding: vec(), embedStatus: "ok" });
    expect(getEmbeddingCandidates(t.db, sourceId)).toHaveLength(1);

    seedAsset(t.db, sourceId, { name: "b.svg", clipEmbedding: vec(), embedStatus: "ok" });
    emitStage({ type: "run-end", sourceId, ms: 1 });
    expect(getEmbeddingCandidates(t.db, sourceId)).toHaveLength(2);

    seedAsset(t.db, sourceId, { name: "c.svg", clipEmbedding: vec(), embedStatus: "ok" });
    emitStage({ type: "run-error", sourceId, ms: 1, error: "boom" });
    expect(getEmbeddingCandidates(t.db, sourceId)).toHaveLength(3);
  });

  it("excludes degenerate embeddings from candidates", () => {
    seedAsset(t.db, sourceId, { name: "ok.svg", clipEmbedding: vec(), embedStatus: "ok" });
    seedAsset(t.db, sourceId, {
      name: "white.svg",
      clipEmbedding: vec(),
      embedStatus: "degenerate",
    });
    seedAsset(t.db, sourceId, { name: "legacy.svg", clipEmbedding: vec() });
    const names = getEmbeddingCandidates(t.db, sourceId).map((c) => c.name);
    expect(names).toContain("ok.svg");
    expect(names).toContain("legacy.svg");
    expect(names).not.toContain("white.svg");
  });
});

describe("clipHealth", () => {
  it("reports degraded above the 20% failure rate", () => {
    for (let i = 0; i < 7; i++) {
      seedAsset(t.db, sourceId, { name: `ok-${i}.svg`, embedStatus: "ok" });
    }
    seedAsset(t.db, sourceId, { name: "f1.svg", embedStatus: "failed" });
    seedAsset(t.db, sourceId, { name: "f2.svg", embedStatus: "failed" });
    seedAsset(t.db, sourceId, { name: "f3.svg", embedStatus: "failed" });

    const health = clipHealth(t.db, sourceId);
    expect(health.ok).toBe(7);
    expect(health.failed).toBe(3);
    expect(health.degraded).toBe(true);
  });

  it("stays healthy at low failure rates and with no data", () => {
    expect(clipHealth(t.db, sourceId).degraded).toBe(false);
    for (let i = 0; i < 9; i++) {
      seedAsset(t.db, sourceId, { name: `ok-${i}.svg`, embedStatus: "ok" });
    }
    seedAsset(t.db, sourceId, { name: "f1.svg", embedStatus: "failed" });
    expect(clipHealth(t.db, sourceId).degraded).toBe(false);
  });
});
