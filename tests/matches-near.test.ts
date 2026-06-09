import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findMatches } from "@/lib/db/queries/matches";
import { computePhash } from "@/lib/indexer/phash";
import type { QuerySignature } from "@/lib/match/ext";
import { createTestDb, seedAsset, seedSource, type TestDb } from "./helpers/test-db";

const FIXTURES = resolve(import.meta.dirname, "fixtures/svg");
const fixture = (name: string): Buffer => readFileSync(join(FIXTURES, name));

function sig(overrides: Partial<QuerySignature>): QuerySignature {
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

// 0x0f vs 0xf0 differs in 8 bits per flipped byte; popcount stays 32 (healthy)
const BASE_PHASH = "0f0f0f0f0f0f0f0f";
const FAR_PHASH = "f0f00f0f0f0f0f0f"; // hamming 16 from BASE_PHASH

let t: TestDb;
let sourceId: number;
let housePhash: string;
let variantPhash: string;
let boltPhash: string;
let dotWavePhash: string;
let confettiPhash: string;

beforeAll(async () => {
  housePhash = (await computePhash(fixture("house.svg"), "svg")) as string;
  variantPhash = (await computePhash(fixture("house-variant.svg"), "svg")) as string;
  boltPhash = (await computePhash(fixture("bolt.svg"), "svg")) as string;
  dotWavePhash = (await computePhash(fixture("dot-wave.svg"), "svg")) as string;
  confettiPhash = (await computePhash(fixture("confetti.svg"), "svg")) as string;

  t = createTestDb();
  sourceId = seedSource(t.db).id;
  seedAsset(t.db, sourceId, { name: "house.svg", phash: housePhash });
  seedAsset(t.db, sourceId, { name: "house-variant.svg", phash: variantPhash });
  seedAsset(t.db, sourceId, { name: "bolt.svg", phash: boltPhash });
  seedAsset(t.db, sourceId, {
    name: "dot-wave.svg",
    phash: dotWavePhash,
    category: "illustration",
  });
  seedAsset(t.db, sourceId, {
    name: "confetti.svg",
    phash: confettiPhash,
    category: "illustration",
  });
  seedAsset(t.db, sourceId, { name: "house-copy.svg", phash: housePhash });
  seedAsset(t.db, sourceId, { name: "base.png", ext: "png", phash: BASE_PHASH });
  seedAsset(t.db, sourceId, { name: "far.png", ext: "png", phash: FAR_PHASH });
  seedAsset(t.db, sourceId, { name: "base-twin.svg", phash: BASE_PHASH });
  seedAsset(t.db, sourceId, { name: "far-twin.svg", phash: FAR_PHASH });
});

afterAll(() => {
  t.cleanup();
});

describe("findNear entropy guards", () => {
  it("regression: healthy near-duplicates still match after the guards", () => {
    const buckets = findMatches(t.db, sourceId, sig({ phash: housePhash }), null);
    const names = buckets.near.map((m) => m.name);
    expect(names).toContain("house-variant.svg");
    expect(buckets.nearDegenerateQuery).toBe(false);
  });

  it("excludes degenerate candidates from the near bucket", () => {
    const buckets = findMatches(t.db, sourceId, sig({ phash: housePhash }), null);
    const names = buckets.near.map((m) => m.name);
    expect(names).not.toContain("dot-wave.svg");
    expect(names).not.toContain("confetti.svg");
  });

  it("returns an empty, flagged near bucket for a degenerate query", () => {
    const buckets = findMatches(t.db, sourceId, sig({ phash: dotWavePhash }), null);
    expect(buckets.near).toEqual([]);
    expect(buckets.nearDegenerateQuery).toBe(true);
  });

  it("applies the SVG ceiling of 8 instead of the raster ceiling", () => {
    const buckets = findMatches(
      t.db,
      sourceId,
      sig({ phash: BASE_PHASH, name: "base-query.svg", stem: "base-query" }),
      null,
    );
    const names = buckets.near.map((m) => m.name);
    expect(names).toContain("base-twin.svg");
    expect(names).not.toContain("far-twin.svg");
    expect(names).not.toContain("bolt.svg");
  });

  it("keeps the looser ceiling of 20 for raster queries", () => {
    const buckets = findMatches(
      t.db,
      sourceId,
      sig({ phash: BASE_PHASH, ext: "png", name: "base-query.png", stem: "base-query" }),
      null,
    );
    const names = buckets.near.map((m) => m.name);
    expect(names).toContain("base.png");
    expect(names).toContain("far.png");
  });

  it("caps displayed similarity at 99% for identical phashes", () => {
    const buckets = findMatches(t.db, sourceId, sig({ phash: housePhash }), null);
    const copy = buckets.near.find((m) => m.name === "house-copy.svg");
    expect(copy).toBeDefined();
    expect(copy?.hamming).toBe(0);
    expect(copy?.pct).toBe(99);
  });
});
