import { and, count, eq, sql, sum } from "drizzle-orm";
import type { Db } from "../client";
import { assets, clusters, usages } from "../schema";

export type OverviewCounts = {
  totalAssets: number;
  totalBytes: number;
  duplicateGroups: number;
  exactReclaimableBytes: number;
  nearMatchClusters: number;
  nameClusters: number;
  unusedAssets: number;
  unusedBytes: number;
};

export function getOverviewCounts(db: Db, sourceId: number): OverviewCounts {
  const totals = db
    .select({
      n: count(),
      bytes: sum(assets.size),
    })
    .from(assets)
    .where(eq(assets.sourceId, sourceId))
    .all()[0];

  const dup = db
    .select({ n: count() })
    .from(clusters)
    .where(and(eq(clusters.sourceId, sourceId), eq(clusters.kind, "hash")))
    .all()[0];

  const near = db
    .select({ n: count() })
    .from(clusters)
    .where(and(eq(clusters.sourceId, sourceId), eq(clusters.kind, "phash")))
    .all()[0];

  const name = db
    .select({ n: count() })
    .from(clusters)
    .where(and(eq(clusters.sourceId, sourceId), eq(clusters.kind, "name")))
    .all()[0];

  const unusedRow = db
    .select({ n: count(), bytes: sum(assets.size) })
    .from(assets)
    .where(
      and(
        eq(assets.sourceId, sourceId),
        sql`NOT EXISTS (SELECT 1 FROM ${usages} WHERE ${usages.assetId} = ${assets.id})`,
      ),
    )
    .all()[0];

  const exactReclaim = db
    .select({
      bytes: sql<number>`COALESCE(SUM((${clusters.size} - 1) * (
        SELECT ${assets.size}
        FROM ${assets}
        WHERE ${assets.id} = (
          SELECT cluster_members.asset_id
          FROM cluster_members
          WHERE cluster_members.cluster_id = ${clusters.id} AND cluster_members.role = 'canonical'
          LIMIT 1
        )
      )), 0)`,
    })
    .from(clusters)
    .where(and(eq(clusters.sourceId, sourceId), eq(clusters.kind, "hash")))
    .all()[0];

  return {
    totalAssets: Number(totals?.n ?? 0),
    totalBytes: Number(totals?.bytes ?? 0),
    duplicateGroups: Number(dup?.n ?? 0),
    exactReclaimableBytes: Number(exactReclaim?.bytes ?? 0),
    nearMatchClusters: Number(near?.n ?? 0),
    nameClusters: Number(name?.n ?? 0),
    unusedAssets: Number(unusedRow?.n ?? 0),
    unusedBytes: Number(unusedRow?.bytes ?? 0),
  };
}
