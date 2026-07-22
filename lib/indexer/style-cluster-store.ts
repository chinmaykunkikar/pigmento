import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { styleClusterMembers, styleClusters } from "../db/schema";
import type { NearMissCluster } from "./color-cluster";

// Members cascade-delete with their cluster (FK onDelete cascade), so wiping
// this (source, kind)'s clusters is enough to clear the pair.
export function rebuildStyleClusters(
  db: Db,
  sourceId: number,
  kind: string,
  clusters: NearMissCluster[],
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
          neutral: c.neutral,
          maxDeltaE: c.maxDeltaE,
        })
        .returning()
        .all();
      if (!row) continue;
      for (const m of c.members) {
        tx.insert(styleClusterMembers)
          .values({
            clusterId: row.id,
            color: m.color,
            role: m.role,
            deltaE: m.deltaE,
            usageCount: m.usageCount,
          })
          .run();
      }
    }
  });
  return clusters.length;
}
