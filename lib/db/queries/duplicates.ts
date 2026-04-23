import { and, asc, count, desc, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../client";
import { assets, clusterMembers, clusters, usages } from "../schema";

function folderClause(folder: string | undefined): SQL | undefined {
  if (!folder) return undefined;
  const escaped = folder.replace(/[\\%_]/g, (c) => `\\${c}`);
  const pattern = `${escaped}/%`;
  return or(eq(assets.dir, folder), sql`${assets.dir} LIKE ${pattern} ESCAPE '\\'`);
}

function folderScopedClusterIds(
  db: Db,
  sourceId: number,
  kind: "hash" | "phash",
  folder: string | undefined,
): Set<number> | null {
  const fc = folderClause(folder);
  if (!fc) return null;
  const rows = db
    .select({ id: clusterMembers.clusterId })
    .from(clusterMembers)
    .innerJoin(clusters, eq(clusters.id, clusterMembers.clusterId))
    .innerJoin(assets, eq(assets.id, clusterMembers.assetId))
    .where(and(eq(clusters.sourceId, sourceId), eq(clusters.kind, kind), fc))
    .groupBy(clusterMembers.clusterId)
    .all();
  return new Set(rows.map((r) => r.id));
}

export type ExactMember = {
  assetId: number;
  role: "canonical" | "member";
  name: string;
  relPath: string;
  size: number;
  usageCount: number;
};

export type ExactGroup = {
  id: number;
  key: string;
  count: number;
  perFileSize: number;
  reclaimableBytes: number;
  canonicalName: string;
  canonicalId: number;
  canonicalExt: string;
  members: ExactMember[];
};

export type ExactDuplicates = {
  groups: ExactGroup[];
  totalGroups: number;
  totalFiles: number;
  reclaimableBytes: number;
};

export type NearPairSide = {
  assetId: number;
  name: string;
  relPath: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  usageCount: number;
};

export type NearPair = {
  clusterId: number;
  hamming: number;
  confidence: "high" | "medium" | "low";
  bucket: "very" | "similar" | "loose";
  a: NearPairSide;
  b: NearPairSide;
};

export type NearDuplicates = {
  pairs: NearPair[];
  histogram: number[];
  maxHamming: number;
};

const NEAR_HISTOGRAM_BINS = 16;

export function listExactDuplicates(db: Db, sourceId: number, folder?: string): ExactDuplicates {
  const scopedIds = folderScopedClusterIds(db, sourceId, "hash", folder);
  if (scopedIds && scopedIds.size === 0) {
    return { groups: [], totalGroups: 0, totalFiles: 0, reclaimableBytes: 0 };
  }
  const clusterRows = db
    .select({
      id: clusters.id,
      key: clusters.key,
      size: clusters.size,
    })
    .from(clusters)
    .where(
      and(
        eq(clusters.sourceId, sourceId),
        eq(clusters.kind, "hash"),
        scopedIds ? inArray(clusters.id, Array.from(scopedIds)) : undefined,
      ),
    )
    .orderBy(desc(clusters.size), asc(clusters.key))
    .all();

  if (clusterRows.length === 0) {
    return { groups: [], totalGroups: 0, totalFiles: 0, reclaimableBytes: 0 };
  }

  const clusterIds = clusterRows.map((c) => c.id);
  const memberRows = db
    .select({
      clusterId: clusterMembers.clusterId,
      assetId: clusterMembers.assetId,
      role: clusterMembers.role,
      name: assets.name,
      relPath: assets.relPath,
      ext: assets.ext,
      size: assets.size,
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

  const byCluster = new Map<number, typeof memberRows>();
  for (const m of memberRows) {
    const list = byCluster.get(m.clusterId) ?? [];
    list.push(m);
    byCluster.set(m.clusterId, list);
  }

  let totalFiles = 0;
  let reclaimable = 0;
  const groups: ExactGroup[] = [];

  for (const c of clusterRows) {
    const rows = byCluster.get(c.id) ?? [];
    if (rows.length < 2) continue;
    const canonical = rows.find((r) => r.role === "canonical") ?? rows[0];
    if (!canonical) continue;

    const perFile = canonical.size;
    const reclaimBytes = perFile * (rows.length - 1);
    totalFiles += rows.length;
    reclaimable += reclaimBytes;

    groups.push({
      id: c.id,
      key: c.key,
      count: rows.length,
      perFileSize: perFile,
      reclaimableBytes: reclaimBytes,
      canonicalName: canonical.name,
      canonicalId: canonical.assetId,
      canonicalExt: canonical.ext,
      members: rows.map((r) => ({
        assetId: r.assetId,
        role: r.role as "canonical" | "member",
        name: r.name,
        relPath: r.relPath,
        size: r.size,
        usageCount: usageCount.get(r.assetId) ?? 0,
      })),
    });
  }

  return {
    groups,
    totalGroups: groups.length,
    totalFiles,
    reclaimableBytes: reclaimable,
  };
}

function bucketFor(h: number): NearPair["bucket"] {
  if (h <= 4) return "very";
  if (h <= 8) return "similar";
  return "loose";
}

function confidenceFor(h: number): NearPair["confidence"] {
  if (h <= 4) return "high";
  if (h <= 8) return "medium";
  return "low";
}

export function listNearPairs(db: Db, sourceId: number, folder?: string): NearDuplicates {
  const scopedIds = folderScopedClusterIds(db, sourceId, "phash", folder);
  if (scopedIds && scopedIds.size === 0) {
    return { pairs: [], histogram: new Array(NEAR_HISTOGRAM_BINS).fill(0), maxHamming: 0 };
  }
  const clusterRows = db
    .select({
      id: clusters.id,
      key: clusters.key,
      size: clusters.size,
    })
    .from(clusters)
    .where(
      and(
        eq(clusters.sourceId, sourceId),
        eq(clusters.kind, "phash"),
        scopedIds ? inArray(clusters.id, Array.from(scopedIds)) : undefined,
      ),
    )
    .orderBy(desc(clusters.size))
    .all();

  if (clusterRows.length === 0) {
    return { pairs: [], histogram: new Array(NEAR_HISTOGRAM_BINS).fill(0), maxHamming: 0 };
  }

  const clusterIds = clusterRows.map((c) => c.id);
  const memberRows = db
    .select({
      clusterId: clusterMembers.clusterId,
      assetId: clusterMembers.assetId,
      role: clusterMembers.role,
      hamming: clusterMembers.hamming,
      name: assets.name,
      relPath: assets.relPath,
      ext: assets.ext,
      size: assets.size,
      width: assets.width,
      height: assets.height,
    })
    .from(clusterMembers)
    .innerJoin(assets, eq(assets.id, clusterMembers.assetId))
    .where(inArray(clusterMembers.clusterId, clusterIds))
    .all();

  const assetIds = memberRows.map((m) => m.assetId);
  const usageRows = db
    .select({ assetId: usages.assetId, n: count() })
    .from(usages)
    .where(inArray(usages.assetId, assetIds))
    .groupBy(usages.assetId)
    .all();
  const usageCount = new Map<number, number>(usageRows.map((r) => [r.assetId, Number(r.n)]));

  const byCluster = new Map<number, typeof memberRows>();
  for (const m of memberRows) {
    const list = byCluster.get(m.clusterId) ?? [];
    list.push(m);
    byCluster.set(m.clusterId, list);
  }

  const toSide = (r: (typeof memberRows)[number]): NearPairSide => ({
    assetId: r.assetId,
    name: r.name,
    relPath: r.relPath,
    ext: r.ext,
    size: r.size,
    width: r.width,
    height: r.height,
    usageCount: usageCount.get(r.assetId) ?? 0,
  });

  const pairs: NearPair[] = [];
  const histogram = new Array(NEAR_HISTOGRAM_BINS).fill(0);
  let maxHamming = 0;

  for (const c of clusterRows) {
    const rows = byCluster.get(c.id) ?? [];
    const canonical = rows.find((r) => r.role === "canonical");
    if (!canonical) continue;
    const others = rows.filter((r) => r.role !== "canonical");
    for (const m of others) {
      const h = m.hamming ?? 0;
      pairs.push({
        clusterId: c.id,
        hamming: h,
        confidence: confidenceFor(h),
        bucket: bucketFor(h),
        a: toSide(canonical),
        b: toSide(m),
      });
      const bin = Math.min(NEAR_HISTOGRAM_BINS - 1, h);
      histogram[bin] += 1;
      if (h > maxHamming) maxHamming = h;
    }
  }

  pairs.sort((a, b) => a.hamming - b.hamming);

  return { pairs, histogram, maxHamming };
}
