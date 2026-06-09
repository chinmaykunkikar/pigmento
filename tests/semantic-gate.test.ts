import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findMatches } from "@/lib/db/queries/matches";
import type { QuerySignature } from "@/lib/match/ext";
import { percentileOf, SEMANTIC_FLOOR, semanticGate } from "@/lib/match/semantic";
import { createTestDb, seedAsset, seedSource, type TestDb } from "./helpers/test-db";

function sig(overrides: Partial<QuerySignature> = {}): QuerySignature {
  return {
    name: "query.svg",
    stem: "query",
    ext: "svg",
    size: 100,
    sha1: "sha-query",
    contentHash: "hash-query",
    phash: null,
    width: 24,
    height: 24,
    dominantColor: null,
    svg: null,
    ...overrides,
  };
}

function unit(x: number, y: number): Float32Array {
  const norm = Math.sqrt(x * x + y * y);
  return new Float32Array([x / norm, y / norm, 0, 0]);
}

// cosine(angleVec(a), angleVec(b)) === cos(a - b), making scores easy to stage
function angleVec(radians: number): Float32Array {
  return unit(Math.cos(radians), Math.sin(radians));
}

describe("semanticGate", () => {
  it("falls back to the absolute floor below the minimum candidate count", () => {
    expect(semanticGate([0.99, 0.98])).toBe(SEMANTIC_FLOOR);
    expect(semanticGate([])).toBe(SEMANTIC_FLOOR);
  });

  it("filters the corpus baseline that defeated the old fixed 0.75 floor", () => {
    // audit-shaped distribution: baseline mass around 0.72 plus one true match
    const baseline = Array.from({ length: 100 }, (_, i) => 0.68 + (i % 10) * 0.008);
    const scores = [...baseline, 0.96];
    const gate = semanticGate(scores);
    expect(gate).toBeGreaterThan(0.75);
    expect(scores.filter((s) => s >= gate)).toEqual([0.96]);
  });

  it("handles MAD=0 (identical scores) without crashing or over-filtering", () => {
    const scores = Array.from({ length: 20 }, () => 0.9);
    const gate = semanticGate(scores);
    expect(gate).toBe(0.9);
    expect(scores.every((s) => s >= gate)).toBe(true);
  });

  it("never gates below the absolute floor", () => {
    const scores = Array.from({ length: 50 }, (_, i) => 0.3 + (i % 5) * 0.001);
    expect(semanticGate(scores)).toBe(SEMANTIC_FLOOR);
  });
});

describe("percentileOf", () => {
  it("ranks a score against the corpus distribution", () => {
    const sorted = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    expect(percentileOf(sorted, 1.0)).toBe(90);
    expect(percentileOf(sorted, 0.1)).toBe(0);
    expect(percentileOf(sorted, 0.55)).toBe(50);
  });
});

describe("findSemantic with the adaptive gate", () => {
  let t: TestDb;
  let sourceId: number;

  beforeAll(() => {
    t = createTestDb();
    sourceId = seedSource(t.db).id;
    // query is angle 0; true match at ~8deg (cos≈0.99); baseline spread around
    // 44deg (cos≈0.72) mirroring the measured corpus baseline
    seedAsset(t.db, sourceId, {
      name: "true-match.svg",
      clipEmbedding: angleVec(0.14),
    });
    for (let i = 0; i < 12; i++) {
      seedAsset(t.db, sourceId, {
        name: `baseline-${i}.svg`,
        clipEmbedding: angleVec(0.75 + i * 0.01),
      });
    }
    seedAsset(t.db, sourceId, { name: "no-embedding.svg" });
  });

  afterAll(() => {
    t.cleanup();
  });

  it("returns only true matches, not the always-full top-10", () => {
    const buckets = findMatches(t.db, sourceId, sig(), angleVec(0));
    const names = buckets.semantic.map((m) => m.name);
    expect(names).toEqual(["true-match.svg"]);
  });

  it("reports corpus percentile alongside the raw score", () => {
    const buckets = findMatches(t.db, sourceId, sig(), angleVec(0));
    const hit = buckets.semantic[0];
    expect(hit?.percentile).toBeGreaterThanOrEqual(90);
    expect(hit?.score).toBeGreaterThan(0.95);
  });

  it("returns an empty bucket when nothing clears the bar", () => {
    // query at 90deg from everything: all cosines near 0
    const buckets = findMatches(t.db, sourceId, sig(), angleVec(Math.PI / 2 + 1.2));
    expect(buckets.semantic).toEqual([]);
  });
});
