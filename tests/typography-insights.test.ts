import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import {
  coveragePct,
  deriveMixedSpellings,
  deriveSizeScale,
  getTypographyScale,
  getTypographyStats,
  listTypeDrift,
  typeSuspicionScore,
} from "@/lib/db/queries/typography";
import { type NewStyleUsage, styleUsages } from "@/lib/db/schema";
import type { StyleClusterInput } from "@/lib/indexer/style-cluster-store";
import { rebuildStyleClusters } from "@/lib/indexer/style-cluster-store";
import { createTestDb, seedSource } from "./helpers/test-db";

function seedUsages(db: Db, sourceId: number, rows: Partial<NewStyleUsage>[]) {
  const values: NewStyleUsage[] = rows.map((r, i) => ({
    sourceId,
    kind: "type",
    rawToken: r.rawToken ?? r.normalizedValue ?? "x",
    relPath: r.relPath ?? `f${i}.css`,
    contextKind: r.contextKind ?? "css-decl",
    ...r,
  }));
  db.insert(styleUsages).values(values).run();
}

describe("type insight — pure scorers", () => {
  it("suspicion rewards popular canonical, many variants, small distance", () => {
    const base = { canonicalUsage: 100, variantUsage: 3, variantCount: 1, maxDistance: 0.2 };
    expect(typeSuspicionScore(base)).toBeGreaterThan(
      typeSuspicionScore({ ...base, canonicalUsage: 2 }),
    );
    expect(typeSuspicionScore(base)).toBeGreaterThan(
      typeSuspicionScore({ ...base, maxDistance: 0.9 }),
    );
    expect(typeSuspicionScore({ ...base, maxDistance: null })).toBeGreaterThan(
      typeSuspicionScore({ ...base, maxDistance: 1 }),
    );
  });

  it("coveragePct handles the empty denominator", () => {
    expect(coveragePct(3, 1)).toBeCloseTo(0.75, 5);
    expect(coveragePct(0, 0)).toBeNull();
  });
});

describe("type insight — getTypographyStats", () => {
  it("buckets coverage: var-ref tokenized, literal, tailwind-named not-scored", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      seedUsages(t.db, sourceId, [
        { contextKind: "css-var-ref", contextDetail: "--fs", axis: "size", relPath: "a.css" },
        { contextKind: "css-var-ref", contextDetail: "--fs", axis: "size", relPath: "b.css" },
        { contextKind: "css-var-ref", contextDetail: "--fs", axis: "size", relPath: "c.css" },
        {
          contextKind: "css-decl",
          contextDetail: "font-size",
          axis: "size",
          normalizedValue: "16",
          rawToken: "16px",
          relPath: "x.css",
        },
        { contextKind: "tailwind-named", axis: "size", rawToken: "text-sm" },
      ]);
      const stats = getTypographyStats(t.db, sourceId);
      expect(stats.coverage).toMatchObject({ tokenized: 3, literal: 1, notScored: 1 });
      expect(stats.coverage.pct).toBeCloseTo(0.75, 5);
      expect(stats.perValue.find((v) => v.axis === "size" && v.value === "16")?.usageCount).toBe(1);
    } finally {
      t.cleanup();
    }
  });

  it("collapses mixed units and spellings onto one normalized value", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      seedUsages(t.db, sourceId, [
        {
          contextKind: "css-decl",
          contextDetail: "font-size",
          axis: "size",
          normalizedValue: "13",
          rawToken: "13px",
          relPath: "a.css",
        },
        {
          contextKind: "css-decl",
          contextDetail: "font-size",
          axis: "size",
          normalizedValue: "13",
          rawToken: "0.8125rem",
          relPath: "b.css",
        },
        {
          contextKind: "css-decl",
          contextDetail: "font-weight",
          axis: "weight",
          normalizedValue: "700",
          rawToken: "bold",
          relPath: "a.css",
        },
        {
          contextKind: "css-decl",
          contextDetail: "font-weight",
          axis: "weight",
          normalizedValue: "700",
          rawToken: "700",
          relPath: "b.css",
        },
      ]);
      const stats = getTypographyStats(t.db, sourceId);
      const size13 = stats.perValue.find((v) => v.axis === "size" && v.value === "13");
      expect(size13?.usageCount).toBe(2);
      expect(size13?.distinctFileCount).toBe(2);

      const mixed = deriveMixedSpellings(stats);
      const mixedSize = mixed.find((m) => m.axis === "size" && m.value === "13");
      expect(mixedSize?.spellings.map((s) => s.raw).sort()).toEqual(["0.8125rem", "13px"]);
      expect(mixed.find((m) => m.axis === "weight" && m.value === "700")?.spellings).toHaveLength(
        2,
      );
    } finally {
      t.cleanup();
    }
  });

  it("does not leak other kinds' rows through the shared table", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      seedUsages(t.db, sourceId, [
        {
          contextKind: "css-decl",
          contextDetail: "font-size",
          axis: "size",
          normalizedValue: "16",
          rawToken: "16px",
        },
      ]);
      t.db
        .insert(styleUsages)
        .values({
          sourceId,
          kind: "color",
          rawToken: "#16",
          relPath: "c.css",
          contextKind: "css-decl",
          normalizedValue: "16",
        })
        .run();
      const stats = getTypographyStats(t.db, sourceId);
      expect(stats.perValue.filter((v) => v.value === "16")).toHaveLength(1);
    } finally {
      t.cleanup();
    }
  });

  it("orders the size ramp ascending and shapes the MCP scale", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      seedUsages(t.db, sourceId, [
        { contextDetail: "font-size", axis: "size", normalizedValue: "20", rawToken: "20px" },
        { contextDetail: "font-size", axis: "size", normalizedValue: "12", rawToken: "12px" },
        { contextDetail: "font-size", axis: "size", normalizedValue: "16", rawToken: "16px" },
        {
          contextDetail: "font-family",
          axis: "family",
          normalizedValue: "inter, sans-serif",
          rawToken: "Inter, sans-serif",
        },
        { contextDetail: "font-weight", axis: "weight", normalizedValue: "700", rawToken: "bold" },
      ]);
      const stats = getTypographyStats(t.db, sourceId);
      expect(deriveSizeScale(stats).map((v) => v.value)).toEqual(["12", "16", "20"]);
      const scale = getTypographyScale(t.db, sourceId);
      expect(scale.sizes.map((s) => s.value)).toEqual(["12", "16", "20"]);
      expect(scale.families.map((f) => f.value)).toEqual(["inter, sans-serif"]);
      expect(scale.weights.map((w) => w.value)).toEqual(["700"]);
    } finally {
      t.cleanup();
    }
  });

  it("empty source yields no values and null coverage", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      const stats = getTypographyStats(t.db, sourceId);
      expect(stats.perValue).toEqual([]);
      expect(stats.coverage.pct).toBeNull();
      expect(deriveMixedSpellings(stats)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

const sizeCluster = (over: Partial<StyleClusterInput>): StyleClusterInput => ({
  key: "size:16",
  canonical: "16",
  size: 2,
  maxDistance: 0.5,
  params: { axis: "size", metric: "px" },
  members: [
    { value: "16", role: "canonical", distance: null, usageCount: 100 },
    { value: "15.5", role: "variant", distance: 0.5, usageCount: 3 },
  ],
  ...over,
});

describe("type insight — listTypeDrift", () => {
  it("resolves a variant's file:line by axis and reports px distance", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      rebuildStyleClusters(t.db, sourceId, "type", [sizeCluster({})]);
      seedUsages(t.db, sourceId, [
        {
          contextDetail: "font-size",
          axis: "size",
          normalizedValue: "15.5",
          rawToken: "15.5px",
          relPath: "drift.css",
          line: 12,
        },
      ]);
      const [finding] = listTypeDrift(t.db, sourceId);
      expect(finding?.axis).toBe("size");
      expect(finding?.canonical).toBe("16");
      expect(finding?.variants[0]).toMatchObject({
        value: "15.5",
        distance: 0.5,
        file: "drift.css",
        line: 12,
      });
    } finally {
      t.cleanup();
    }
  });

  it("scopes the location lookup to the cluster's axis (size 400 != weight 400)", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      rebuildStyleClusters(t.db, sourceId, "type", [
        sizeCluster({
          key: "size:401",
          canonical: "401",
          members: [
            { value: "401", role: "canonical", distance: null, usageCount: 100 },
            { value: "400", role: "variant", distance: 1, usageCount: 2 },
          ],
        }),
      ]);
      seedUsages(t.db, sourceId, [
        {
          contextDetail: "font-size",
          axis: "size",
          normalizedValue: "400",
          rawToken: "400px",
          relPath: "size.css",
          line: 5,
        },
        {
          contextDetail: "font-weight",
          axis: "weight",
          normalizedValue: "400",
          rawToken: "400",
          relPath: "weight.css",
          line: 99,
        },
      ]);
      const [finding] = listTypeDrift(t.db, sourceId);
      expect(finding?.variants[0]).toMatchObject({ file: "size.css", line: 5 });
    } finally {
      t.cleanup();
    }
  });

  it("ranks family drift and tags each finding's axis", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      rebuildStyleClusters(t.db, sourceId, "type", [
        sizeCluster({}),
        {
          key: "family:inter",
          canonical: "inter, sans-serif",
          size: 2,
          maxDistance: null,
          params: { axis: "family", metric: "stack" },
          members: [
            { value: "inter, sans-serif", role: "canonical", distance: null, usageCount: 4 },
            { value: "inter, arial, sans-serif", role: "variant", distance: null, usageCount: 1 },
          ],
        },
      ]);
      const findings = listTypeDrift(t.db, sourceId);
      expect(new Set(findings.map((f) => f.axis))).toEqual(new Set(["size", "family"]));
      expect(findings[0]?.axis).toBe("size");
    } finally {
      t.cleanup();
    }
  });

  it("returns nothing for a source with no clusters", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      expect(listTypeDrift(t.db, sourceId)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});
