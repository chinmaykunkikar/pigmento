import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../client";
import { assets, clusterMembers, clusters, usages } from "../schema";

export type GroupSort = "size" | "alpha";

export type GroupMember = {
  assetId: number;
  role: "canonical" | "member";
  name: string;
  stem: string;
  relPath: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  mtime: number;
  usageCount: number;
};

export type Group = {
  id: number;
  kind: "name" | "hash" | "phash";
  key: string;
  size: number;
  members: GroupMember[];
};

export type GroupsPage = {
  groups: Group[];
  total: number;
  totalVariants: number;
};

export function listNameGroups(
  db: Db,
  sourceId: number,
  sort: GroupSort,
  limit: number,
  offset: number,
): GroupsPage {
  const [{ total }] = db
    .select({ total: count() })
    .from(clusters)
    .where(and(eq(clusters.sourceId, sourceId), eq(clusters.kind, "name")))
    .all() as [{ total: number }];

  const [{ totalVariants }] = db
    .select({ totalVariants: count() })
    .from(clusterMembers)
    .innerJoin(clusters, eq(clusters.id, clusterMembers.clusterId))
    .where(and(eq(clusters.sourceId, sourceId), eq(clusters.kind, "name")))
    .all() as [{ totalVariants: number }];

  const sortExpr = sort === "alpha" ? asc(clusters.key) : desc(clusters.size);
  const clusterRows = db
    .select({
      id: clusters.id,
      kind: clusters.kind,
      key: clusters.key,
      size: clusters.size,
    })
    .from(clusters)
    .where(and(eq(clusters.sourceId, sourceId), eq(clusters.kind, "name")))
    .orderBy(sortExpr, asc(clusters.key))
    .limit(limit)
    .offset(offset)
    .all();

  if (clusterRows.length === 0) {
    return { groups: [], total, totalVariants };
  }

  const clusterIds = clusterRows.map((c) => c.id);
  const memberRows = db
    .select({
      clusterId: clusterMembers.clusterId,
      assetId: clusterMembers.assetId,
      role: clusterMembers.role,
      name: assets.name,
      stem: assets.stem,
      relPath: assets.relPath,
      ext: assets.ext,
      size: assets.size,
      width: assets.width,
      height: assets.height,
      mtime: assets.mtime,
    })
    .from(clusterMembers)
    .innerJoin(assets, eq(assets.id, clusterMembers.assetId))
    .where(inArray(clusterMembers.clusterId, clusterIds))
    .orderBy(desc(clusterMembers.role), asc(assets.relPath))
    .all();

  const assetIds = memberRows.map((m) => m.assetId);
  const usageRows = db
    .select({ assetId: usages.assetId, n: count() })
    .from(usages)
    .where(inArray(usages.assetId, assetIds))
    .groupBy(usages.assetId)
    .all();
  const usageCount = new Map<number, number>(usageRows.map((r) => [r.assetId, Number(r.n)]));

  const byCluster = new Map<number, GroupMember[]>();
  for (const m of memberRows) {
    const list = byCluster.get(m.clusterId) ?? [];
    list.push({
      assetId: m.assetId,
      role: m.role as "canonical" | "member",
      name: m.name,
      stem: m.stem,
      relPath: m.relPath,
      ext: m.ext,
      size: m.size,
      width: m.width,
      height: m.height,
      mtime: m.mtime,
      usageCount: usageCount.get(m.assetId) ?? 0,
    });
    byCluster.set(m.clusterId, list);
  }

  const groups: Group[] = clusterRows.map((c) => ({
    id: c.id,
    kind: c.kind as "name" | "hash" | "phash",
    key: c.key,
    size: c.size,
    members: byCluster.get(c.id) ?? [],
  }));

  return { groups, total, totalVariants };
}
