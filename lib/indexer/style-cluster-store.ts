import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { styleClusterMembers, styleClusters } from "../db/schema";

// Kind-agnostic cluster shape both color and type clustering emit. Per-kind
// divergence rides `params` (OV-3): color leaves it null; type carries
// { axis, metric }. `distance`/`maxDistance` are in the kind's own metric
// (ΔE2000 for color, px for size, null for family).
export type StyleClusterMemberInput = {
  value: string;
  role: "canonical" | "variant";
  distance: number | null;
  usageCount: number;
};

export type StyleClusterInput = {
  key: string;
  canonical: string;
  size: number;
  members: StyleClusterMemberInput[];
  neutral?: boolean;
  maxDistance?: number | null;
  params?: Record<string, unknown> | null;
};

// Members cascade-delete with their cluster (FK onDelete cascade), so wiping
// this (source, kind)'s clusters is enough to clear the pair.
export function rebuildStyleClusters(
  db: Db,
  sourceId: number,
  kind: string,
  clusters: StyleClusterInput[],
): number {
  db.transaction((tx) => {
    tx.delete(styleClusters)
      .where(and(eq(styleClusters.sourceId, sourceId), eq(styleClusters.kind, kind)))
      .run();
    for (const c of clusters) {
      const [row] = tx
        .insert(styleClusters)
        .values({
          sourceId,
          kind,
          key: c.key,
          canonical: c.canonical,
          size: c.size,
          neutral: c.neutral ?? false,
          maxDistance: c.maxDistance ?? null,
          params: c.params ? JSON.stringify(c.params) : null,
        })
        .returning()
        .all();
      if (!row) continue;
      for (const m of c.members) {
        tx.insert(styleClusterMembers)
          .values({
            clusterId: row.id,
            value: m.value,
            role: m.role,
            distance: m.distance,
            usageCount: m.usageCount,
          })
          .run();
      }
    }
  });
  return clusters.length;
}
