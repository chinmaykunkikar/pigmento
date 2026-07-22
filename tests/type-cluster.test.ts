import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { styleClusterMembers, styleClusters } from "@/lib/db/schema";
import { rebuildStyleClusters } from "@/lib/indexer/style-cluster-store";
import { clusterTypography, type TypeValueCount } from "@/lib/indexer/type-cluster";
import { createTestDb, seedSource } from "./helpers/test-db";

const size = (value: string, count: number): TypeValueCount => ({ axis: "size", value, count });
const family = (value: string, count: number): TypeValueCount => ({ axis: "family", value, count });

describe("type clustering — sizes", () => {
  it("clusters a fractional near-miss below a more-popular size", () => {
    const [c] = clusterTypography([size("13", 100), size("13.5", 3)]);
    expect(c?.key).toBe("size:13");
    expect(c?.canonical).toBe("13");
    const variant = c?.members.find((m) => m.role === "variant");
    expect(variant).toMatchObject({ value: "13.5", distance: 0.5 });
    expect(c?.params).toMatchObject({ axis: "size", metric: "px" });
  });

  it("does not cluster an integer scale step exactly 1px away", () => {
    expect(clusterTypography([size("13", 100), size("14", 3)])).toHaveLength(0);
    expect(clusterTypography([size("13", 100), size("15", 3)])).toHaveLength(0);
  });

  it("does not cluster equally-popular sizes", () => {
    expect(clusterTypography([size("13", 50), size("13.5", 50)])).toHaveLength(0);
  });
});

describe("type clustering — families", () => {
  it("clusters same-first-family stacks with differing fallback tails", () => {
    const [c] = clusterTypography([
      family("inter, sans-serif", 100),
      family("inter, arial, sans-serif", 3),
    ]);
    expect(c?.key).toBe("family:inter");
    expect(c?.canonical).toBe("inter, sans-serif");
    expect(c?.members.find((m) => m.role === "variant")?.value).toBe("inter, arial, sans-serif");
  });

  it("does not cluster a first family with a single stack", () => {
    expect(clusterTypography([family("inter, sans-serif", 5)])).toHaveLength(0);
  });
});

describe("type clustering — weight/line-height are exact-only in v1", () => {
  it("produces no near-miss clusters for weight or line-height", () => {
    expect(
      clusterTypography([
        { axis: "weight", value: "400", count: 100 },
        { axis: "weight", value: "500", count: 3 },
        { axis: "line-height", value: "1.5", count: 100 },
        { axis: "line-height", value: "1.6", count: 3 },
      ]),
    ).toHaveLength(0);
  });
});

describe("type clustering — persistence (real migrations)", () => {
  it("round-trips type clusters, isolated by kind and axis-prefixed keys", () => {
    const t = createTestDb();
    try {
      const sourceId = seedSource(t.db).id;
      rebuildStyleClusters(
        t.db,
        sourceId,
        "type",
        clusterTypography([
          size("13", 100),
          size("13.5", 3),
          family("inter, sans-serif", 10),
          family("inter, arial, sans-serif", 2),
        ]),
      );
      const rows = t.db
        .select()
        .from(styleClusters)
        .where(and(eq(styleClusters.sourceId, sourceId), eq(styleClusters.kind, "type")))
        .all();
      expect(rows.map((r) => r.key).sort()).toEqual(["family:inter", "size:13"]);
      const sizeRow = rows.find((r) => r.key === "size:13");
      const members = t.db
        .select()
        .from(styleClusterMembers)
        .where(eq(styleClusterMembers.clusterId, sizeRow?.id ?? -1))
        .all();
      expect(members).toHaveLength(2);
    } finally {
      t.cleanup();
    }
  });
});
