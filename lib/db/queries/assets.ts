import { count, eq, inArray } from "drizzle-orm";
import type { AssetRef } from "@/lib/plan/schema";
import type { Db } from "../client";
import { assets, usages } from "../schema";

export function countAssets(db: Db, sourceId: number): number {
  const [row] = db.select({ c: count() }).from(assets).where(eq(assets.sourceId, sourceId)).all();
  return row?.c ?? 0;
}

export function getAssetRefs(db: Db, ids: number[]): AssetRef[] {
  if (ids.length === 0) return [];
  const rows = db
    .select({
      assetId: assets.id,
      relPath: assets.relPath,
      name: assets.name,
      size: assets.size,
    })
    .from(assets)
    .where(inArray(assets.id, ids))
    .all();

  const usageRows = db
    .select({ assetId: usages.assetId, n: count() })
    .from(usages)
    .where(inArray(usages.assetId, ids))
    .groupBy(usages.assetId)
    .all();
  const usageMap = new Map<number, number>(usageRows.map((r) => [r.assetId, Number(r.n)]));

  const order = new Map<number, number>(ids.map((id, i) => [id, i]));
  return rows
    .map((r) => ({
      assetId: r.assetId,
      relPath: r.relPath,
      name: r.name,
      size: r.size,
      usageCount: usageMap.get(r.assetId) ?? 0,
    }))
    .sort((a, b) => (order.get(a.assetId) ?? 0) - (order.get(b.assetId) ?? 0));
}
