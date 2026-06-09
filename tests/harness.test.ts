import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { computePhash, hamming } from "@/lib/indexer/phash";
import { createTempGitRepo } from "./helpers/temp-git";
import { createTestDb, seedAsset, seedSource } from "./helpers/test-db";

const FIXTURES = resolve(import.meta.dirname, "fixtures/svg");
const fixture = (name: string): Buffer => readFileSync(join(FIXTURES, name));

function popcount(hex: string): number {
  let n = BigInt(`0x${hex}`);
  let c = 0;
  while (n) {
    c += Number(n & 1n);
    n >>= 1n;
  }
  return c;
}

describe("test-db builder", () => {
  it("applies migrations and round-trips an asset", () => {
    const t = createTestDb();
    try {
      const source = seedSource(t.db);
      const asset = seedAsset(t.db, source.id, {
        name: "house.svg",
        phash: "00ff00ff00ff00ff",
      });
      const found = t.db.select().from(schema.assets).where(eq(schema.assets.id, asset.id)).get();
      expect(found?.name).toBe("house.svg");
      expect(found?.phash).toBe("00ff00ff00ff00ff");
      expect(found?.sourceId).toBe(source.id);
    } finally {
      t.cleanup();
    }
  });

  it("enforces foreign keys (asset requires source)", () => {
    const t = createTestDb();
    try {
      expect(() => seedAsset(t.db, 9999, { name: "orphan.svg" })).toThrow();
    } finally {
      t.cleanup();
    }
  });
});

describe("fixture corpus", () => {
  it("degenerate illustrations white-collapse (popcount below entropy floor)", async () => {
    for (const name of ["dot-wave.svg", "confetti.svg"]) {
      const phash = await computePhash(fixture(name), "svg");
      expect(phash, `${name} should produce a phash`).toBeTruthy();
      expect(popcount(phash as string), `${name} popcount`).toBeLessThan(12);
    }
  });

  it("healthy icons carry real signal (popcount within 12-52)", async () => {
    for (const name of ["house.svg", "bolt.svg"]) {
      const phash = await computePhash(fixture(name), "svg");
      expect(phash, `${name} should produce a phash`).toBeTruthy();
      const pc = popcount(phash as string);
      expect(pc, `${name} popcount`).toBeGreaterThanOrEqual(12);
      expect(pc, `${name} popcount`).toBeLessThanOrEqual(52);
    }
  });

  it("near-duplicate pair sits within the SVG hamming ceiling", async () => {
    const a = await computePhash(fixture("house.svg"), "svg");
    const b = await computePhash(fixture("house-variant.svg"), "svg");
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(hamming(a as string, b as string)).toBeLessThanOrEqual(8);
  });

  it("unrelated healthy icons are not near-duplicates", async () => {
    const a = await computePhash(fixture("house.svg"), "svg");
    const b = await computePhash(fixture("bolt.svg"), "svg");
    expect(hamming(a as string, b as string)).toBeGreaterThan(8);
  });
});

describe("temp-git helper", () => {
  it("initializes a repo, writes, and commits", () => {
    const repo = createTempGitRepo();
    try {
      repo.write("src/icons/house.svg", "<svg/>");
      const sha = repo.commit("add house icon");
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
      expect(repo.git("log", "-1", "--format=%s")).toBe("add house icon");
      expect(repo.git("status", "--porcelain")).toBe("");
    } finally {
      repo.cleanup();
    }
  });
});
