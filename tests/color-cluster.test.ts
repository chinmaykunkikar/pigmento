import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { styleClusterMembers, styleClusters, styleUsages } from "@/lib/db/schema";
import { clusterColors } from "@/lib/indexer/color-cluster";
import type { ColorUsageHit } from "@/lib/indexer/color-extract";
import { rebuildStyleClusters } from "@/lib/indexer/style-cluster-store";
import { rebuildStyleUsages } from "@/lib/indexer/style-usage-store";
import { createTestDb, seedSource } from "./helpers/test-db";

describe("color clustering", () => {
  it("links a low-usage near-miss variant to its high-usage canonical", () => {
    const clusters = clusterColors([
      { color: "#402678", count: 100 },
      { color: "#3f2678", count: 3 },
      { color: "#ff0000", count: 40 },
    ]);
    expect(clusters).toHaveLength(1);
    const c = clusters[0];
    expect(c?.canonical).toBe("#402678");
    expect(c?.size).toBe(2);
    expect(c?.neutral).toBe(false);
    const variant = c?.members.find((m) => m.role === "variant");
    expect(variant?.color).toBe("#3f2678");
    expect(variant?.deltaE).toBeCloseTo(0.207, 2);
  });

  it("respects the ΔE2000 < 6 boundary", () => {
    const near = clusterColors([
      { color: "#808080", count: 10 },
      { color: "#909090", count: 2 },
    ]);
    expect(near).toHaveLength(1);
    const far = clusterColors([
      { color: "#808080", count: 10 },
      { color: "#a0a0a0", count: 2 },
    ]);
    expect(far).toHaveLength(0);
  });

  it("flags neutral (low-chroma) clusters for downweight", () => {
    const [gray] = clusterColors([
      { color: "#808080", count: 10 },
      { color: "#818181", count: 2 },
    ]);
    expect(gray?.neutral).toBe(true);
  });

  it("uses star topology by usage, not transitive chaining", () => {
    const clusters = clusterColors([
      { color: "#808080", count: 100 },
      { color: "#909090", count: 50 },
      { color: "#a0a0a0", count: 10 },
    ]);
    expect(clusters).toHaveLength(1);
    const c = clusters[0];
    expect(c?.size).toBe(2);
    expect(c?.members.map((m) => m.color).sort()).toEqual(["#808080", "#909090"]);
  });

  it("excludes one-off colors with no near neighbor", () => {
    expect(clusterColors([{ color: "#402678", count: 100 }])).toHaveLength(0);
  });
});

describe("style-table persistence (real migrations)", () => {
  const hit = (over: Partial<ColorUsageHit>): ColorUsageHit => ({
    sourceId: 1,
    kind: "color",
    normalizedColor: "#402678",
    alpha: null,
    rawToken: "#402678",
    relPath: "app.css",
    absPath: "/app.css",
    line: 1,
    col: 0,
    startOffset: 0,
    endOffset: 7,
    snippet: "color: #402678",
    contextKind: "css-decl",
    contextDetail: "color",
    ...over,
  });

  it("round-trips usages and near-miss clusters through the schema", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      const hits = [
        ...Array.from({ length: 5 }, () => hit({ sourceId })),
        hit({ sourceId, normalizedColor: "#3f2678", rawToken: "#3f2678" }),
        hit({ sourceId, normalizedColor: null, rawToken: "var(--x)", contextKind: "css-var-ref" }),
      ];
      const written = rebuildStyleUsages(t.db, sourceId, "color", hits);
      expect(written).toBe(7);

      const stored = t.db
        .select()
        .from(styleUsages)
        .where(and(eq(styleUsages.sourceId, sourceId), eq(styleUsages.kind, "color")))
        .all();
      expect(stored).toHaveLength(7);
      expect(stored.filter((r) => r.normalizedColor === null)).toHaveLength(1);

      const clusters = clusterColors([
        { color: "#402678", count: 5 },
        { color: "#3f2678", count: 1 },
      ]);
      rebuildStyleClusters(t.db, sourceId, "color", clusters);

      const [row] = t.db
        .select()
        .from(styleClusters)
        .where(eq(styleClusters.sourceId, sourceId))
        .all();
      expect(row?.canonical).toBe("#402678");
      const members = t.db
        .select()
        .from(styleClusterMembers)
        .where(eq(styleClusterMembers.clusterId, row?.id ?? -1))
        .all();
      expect(members).toHaveLength(2);
    } finally {
      t.cleanup();
    }
  });

  it("rebuild deletes only the same kind's rows", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      rebuildStyleUsages(t.db, sourceId, "type", [
        { sourceId, kind: "type", rawToken: "16px", relPath: "app.css", contextKind: "other" },
      ]);
      rebuildStyleUsages(t.db, sourceId, "color", [hit({ sourceId })]);

      const typeRows = t.db
        .select()
        .from(styleUsages)
        .where(and(eq(styleUsages.sourceId, sourceId), eq(styleUsages.kind, "type")))
        .all();
      expect(typeRows).toHaveLength(1);
    } finally {
      t.cleanup();
    }
  });
});
