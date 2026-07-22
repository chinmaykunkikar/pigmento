import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import {
  brandScore,
  contextWeightFor,
  coveragePct,
  deriveOneOffs,
  derivePalette,
  getColorStats,
  listColorDrift,
  suspicionScore,
} from "@/lib/db/queries/colors";
import { type NewStyleUsage, styleUsages } from "@/lib/db/schema";
import type { StyleClusterInput } from "@/lib/indexer/style-cluster-store";
import { rebuildStyleClusters } from "@/lib/indexer/style-cluster-store";
import { createTestDb, seedSource } from "./helpers/test-db";

function seedUsages(db: Db, sourceId: number, rows: Partial<NewStyleUsage>[]) {
  const values: NewStyleUsage[] = rows.map((r, i) => ({
    sourceId,
    kind: "color",
    rawToken: r.rawToken ?? r.normalizedValue ?? "x",
    relPath: r.relPath ?? `f${i}.css`,
    contextKind: r.contextKind ?? "css-decl",
    ...r,
  }));
  db.insert(styleUsages).values(values).run();
}

describe("color insight — pure scorers", () => {
  it("weights brand-bearing contexts above chrome", () => {
    expect(contextWeightFor("css-decl", "background")).toBe(1.0);
    expect(contextWeightFor("css-var-def", "--brand")).toBe(1.0);
    expect(contextWeightFor("css-decl", "border")).toBe(0.3);
    expect(contextWeightFor("css-var-ref", "--brand")).toBe(0.8);
    expect(contextWeightFor("tailwind-arbitrary", "bg")).toBe(1.0);
    expect(contextWeightFor("svg-attr", null)).toBe(0.5);
  });

  it("brandScore rises with weighted usage and file spread", () => {
    expect(brandScore(100, 8)).toBeGreaterThan(brandScore(2, 1));
    expect(brandScore(10, 5)).toBeGreaterThan(brandScore(10, 1));
  });

  it("suspicion rewards popular canonical, many variants, small ΔE", () => {
    const base = { canonicalUsage: 100, variantUsage: 3, variantCount: 1, maxDeltaE: 0.2 };
    expect(suspicionScore(base)).toBeGreaterThan(suspicionScore({ ...base, canonicalUsage: 2 }));
    expect(suspicionScore(base)).toBeGreaterThan(suspicionScore({ ...base, maxDeltaE: 5.5 }));
  });

  it("coveragePct handles the empty denominator", () => {
    expect(coveragePct(200, 2)).toBeCloseTo(0.99, 2);
    expect(coveragePct(0, 0)).toBeNull();
  });
});

describe("color insight — getColorStats", () => {
  it("resolves color var-refs; ignores non-color var-refs; buckets coverage", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      seedUsages(t.db, sourceId, [
        {
          contextKind: "css-var-def",
          contextDetail: "--brand",
          normalizedValue: "#402678",
          relPath: "tokens.css",
        },
        { contextKind: "css-var-ref", contextDetail: "--brand", relPath: "a.css" },
        { contextKind: "css-var-ref", contextDetail: "--brand", relPath: "b.css" },
        { contextKind: "css-var-ref", contextDetail: "--brand", relPath: "c.css" },
        { contextKind: "css-var-ref", contextDetail: "--space" },
        { contextKind: "css-var-ref", contextDetail: "--space" },
        {
          contextKind: "css-decl",
          contextDetail: "color",
          normalizedValue: "#ff0000",
          relPath: "x.css",
        },
        { contextKind: "tailwind-named", rawToken: "text-red-500" },
      ]);
      const stats = getColorStats(t.db, sourceId);
      expect(stats.coverage).toMatchObject({
        tokenized: 3,
        literal: 1,
        definitions: 1,
        notScored: 1,
        unresolvedVars: 2,
      });
      expect(stats.coverage.pct).toBeCloseTo(0.75, 5);

      const brand = stats.perColor.find((c) => c.color === "#402678");
      expect(brand?.usageCount).toBe(4);
      expect(brand?.distinctFileCount).toBe(4);
      expect(stats.perColor.find((c) => c.color === "#ff0000")?.usageCount).toBe(1);
    } finally {
      t.cleanup();
    }
  });

  it("does not leak other kinds' rows through the shared table", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      seedUsages(t.db, sourceId, [
        { contextKind: "css-decl", contextDetail: "color", normalizedValue: "#402678" },
      ]);
      t.db
        .insert(styleUsages)
        .values({
          sourceId,
          kind: "type",
          rawToken: "#402678",
          relPath: "t.css",
          contextKind: "css-decl",
          normalizedValue: "#402678",
        })
        .run();
      const stats = getColorStats(t.db, sourceId);
      expect(stats.perColor.find((c) => c.color === "#402678")?.usageCount).toBe(1);
    } finally {
      t.cleanup();
    }
  });

  it("empty source yields no colors and null coverage", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      const stats = getColorStats(t.db, sourceId);
      expect(stats.perColor).toEqual([]);
      expect(stats.coverage.pct).toBeNull();
      expect(derivePalette(stats)).toEqual([]);
      expect(deriveOneOffs(stats)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

const cluster = (over: Partial<StyleClusterInput>): StyleClusterInput => ({
  key: "#402678",
  canonical: "#402678",
  size: 2,
  neutral: false,
  maxDistance: 0.21,
  members: [
    { value: "#402678", role: "canonical", distance: null, usageCount: 100 },
    { value: "#3f2678", role: "variant", distance: 0.21, usageCount: 3 },
  ],
  ...over,
});

describe("color insight — listColorDrift", () => {
  it("suggests the most-referenced defining var and a variant location", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      rebuildStyleClusters(t.db, sourceId, "color", [cluster({})]);
      seedUsages(t.db, sourceId, [
        { contextKind: "css-var-def", contextDetail: "--brand", normalizedValue: "#402678" },
        { contextKind: "css-var-def", contextDetail: "--alias", normalizedValue: "#402678" },
        { contextKind: "css-var-ref", contextDetail: "--brand" },
        { contextKind: "css-var-ref", contextDetail: "--brand" },
        { contextKind: "css-var-ref", contextDetail: "--alias" },
        {
          contextKind: "css-decl",
          contextDetail: "color",
          normalizedValue: "#3f2678",
          relPath: "drift.css",
          line: 12,
        },
      ]);
      const [finding] = listColorDrift(t.db, sourceId);
      expect(finding?.canonical).toBe("#402678");
      expect(finding?.suggestedToken).toBe("--brand");
      expect(finding?.variants[0]).toMatchObject({ color: "#3f2678", file: "drift.css", line: 12 });
    } finally {
      t.cleanup();
    }
  });

  it("falls back to the hex when no var defines the canonical", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      rebuildStyleClusters(t.db, sourceId, "color", [cluster({})]);
      const [finding] = listColorDrift(t.db, sourceId);
      expect(finding?.suggestedToken).toBe("#402678");
    } finally {
      t.cleanup();
    }
  });

  it("ranks neutral clusters below chromatic ones of equal shape", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      rebuildStyleClusters(t.db, sourceId, "color", [
        cluster({
          key: "#808080",
          canonical: "#808080",
          neutral: true,
          members: [
            { value: "#808080", role: "canonical", distance: null, usageCount: 100 },
            { value: "#818181", role: "variant", distance: 0.21, usageCount: 3 },
          ],
        }),
        cluster({}),
      ]);
      const findings = listColorDrift(t.db, sourceId);
      expect(findings.map((f) => f.canonical)).toEqual(["#402678", "#808080"]);
    } finally {
      t.cleanup();
    }
  });

  it("returns nothing for a source with no clusters", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      expect(listColorDrift(t.db, sourceId)).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});
