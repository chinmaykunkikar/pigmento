import { and, asc, count, desc, eq, gt, like, ne } from "drizzle-orm";
import { jaccard, sharedTokens, tokenize } from "@/lib/indexer/name-tokens";
import { hamming as hammingDistance } from "@/lib/indexer/phash";
import { parsePixelSuffix, pixelSizeFromPath } from "@/lib/indexer/variants";
import type { Db } from "../client";
import { type Asset, assets, clusterMembers, clusters, usages } from "../schema";

export type ClusterMemberSummary = {
  assetId: number;
  role: "canonical" | "member";
  hamming: number | null;
  name: string;
  relPath: string;
  ext: string;
  size: number;
};

export type ClusterDetail = {
  id: number;
  kind: "name" | "hash" | "phash";
  key: string;
  size: number;
  members: ClusterMemberSummary[];
};

export type NearDuplicate = {
  assetId: number;
  name: string;
  relPath: string;
  ext: string;
  size: number;
  hamming: number;
};

export type NameSibling = {
  assetId: number;
  name: string;
  relPath: string;
  ext: string;
  size: number;
  shared: string[];
  score: number;
  hamming: number | null;
};

export type SizeVariant = {
  size: number;
  assetId: number;
  name: string;
};

export type AssetDetail = {
  asset: Asset;
  usageCount: number;
  clusters: ClusterDetail[];
  nearDuplicates: NearDuplicate[];
  nameSiblings: NameSibling[];
  sizeVariants: SizeVariant[];
};

const NEAR_DUP_SVG_THRESHOLD = 6;
const NEAR_DUP_RASTER_THRESHOLD = 10;
const NEAR_DUP_LIMIT = 20;

const NAME_FAMILY_SVG_THRESHOLD = 16;
const NAME_FAMILY_RASTER_THRESHOLD = 20;

function nearDupThreshold(ext: string): number {
  return ext === "svg" ? NEAR_DUP_SVG_THRESHOLD : NEAR_DUP_RASTER_THRESHOLD;
}

function nameFamilyThreshold(ext: string): number {
  return ext === "svg" ? NAME_FAMILY_SVG_THRESHOLD : NAME_FAMILY_RASTER_THRESHOLD;
}

export function findAssetDetail(db: Db, id: number): AssetDetail | null {
  const [asset] = db.select().from(assets).where(eq(assets.id, id)).all();
  if (!asset) return null;

  const [{ n }] = db.select({ n: count() }).from(usages).where(eq(usages.assetId, id)).all() as [
    { n: number },
  ];

  const memberships = db
    .select({
      clusterId: clusterMembers.clusterId,
      hamming: clusterMembers.hamming,
      kind: clusters.kind,
      key: clusters.key,
      size: clusters.size,
    })
    .from(clusterMembers)
    .innerJoin(clusters, eq(clusters.id, clusterMembers.clusterId))
    .where(eq(clusterMembers.assetId, id))
    .all();

  const clusterDetails: ClusterDetail[] = memberships
    .filter((m) => m.kind !== "phash")
    .map((m) => {
      const rows = db
        .select({
          assetId: clusterMembers.assetId,
          role: clusterMembers.role,
          hamming: clusterMembers.hamming,
          name: assets.name,
          relPath: assets.relPath,
          ext: assets.ext,
          size: assets.size,
        })
        .from(clusterMembers)
        .innerJoin(assets, eq(assets.id, clusterMembers.assetId))
        .where(eq(clusterMembers.clusterId, m.clusterId))
        .orderBy(desc(clusterMembers.role), asc(assets.relPath))
        .all();

      return {
        id: m.clusterId,
        kind: m.kind as ClusterDetail["kind"],
        key: m.key,
        size: m.size,
        members: rows.map((r) => ({
          assetId: r.assetId,
          role: r.role as "canonical" | "member",
          hamming: r.hamming,
          name: r.name,
          relPath: r.relPath,
          ext: r.ext,
          size: r.size,
        })),
      };
    });

  const nearDuplicates = findNearDuplicates(db, asset);
  const nearDupIds = new Set(nearDuplicates.map((d) => d.assetId));
  const hashDupIds = new Set(
    clusterDetails.filter((c) => c.kind === "hash").flatMap((c) => c.members.map((m) => m.assetId)),
  );
  const nameSiblings = findNameSiblings(db, asset, new Set([...nearDupIds, ...hashDupIds]));
  const sizeVariants = findSizeVariants(db, asset);

  return {
    asset,
    usageCount: n,
    clusters: clusterDetails,
    nearDuplicates,
    nameSiblings,
    sizeVariants,
  };
}

const NAME_SIBLING_LIMIT = 15;

function findNameSiblings(db: Db, asset: Asset, excludeIds: Set<number>): NameSibling[] {
  const tokens = tokenize(asset.stem);
  if (tokens.size === 0) return [];
  if (!asset.phash) return [];

  const rows = db
    .select({
      id: assets.id,
      stem: assets.stem,
      name: assets.name,
      relPath: assets.relPath,
      ext: assets.ext,
      size: assets.size,
      phash: assets.phash,
    })
    .from(assets)
    .where(and(eq(assets.sourceId, asset.sourceId), ne(assets.id, asset.id)))
    .all();

  const visualThreshold = nameFamilyThreshold(asset.ext);
  const hits: NameSibling[] = [];
  for (const r of rows) {
    if (excludeIds.has(r.id)) continue;
    if (!r.phash) continue;
    const otherTokens = tokenize(r.stem);
    const shared = sharedTokens(tokens, otherTokens);
    if (shared.length === 0) continue;
    const score = jaccard(tokens, otherTokens);
    if (score < 0.2) continue;
    const h = hammingDistance(asset.phash, r.phash);
    if (h > visualThreshold) continue;
    hits.push({
      assetId: r.id,
      name: r.name,
      relPath: r.relPath,
      ext: r.ext,
      size: r.size,
      shared,
      score,
      hamming: h,
    });
  }
  hits.sort((a, b) => (a.hamming ?? 64) - (b.hamming ?? 64) || b.score - a.score);
  return hits.slice(0, NAME_SIBLING_LIMIT);
}

function findNearDuplicates(db: Db, asset: Asset): NearDuplicate[] {
  if (!asset.phash) return [];
  const threshold = nearDupThreshold(asset.ext);
  const candidates = db
    .select({
      id: assets.id,
      name: assets.name,
      relPath: assets.relPath,
      ext: assets.ext,
      size: assets.size,
      phash: assets.phash,
    })
    .from(assets)
    .where(
      and(eq(assets.sourceId, asset.sourceId), eq(assets.ext, asset.ext), ne(assets.id, asset.id)),
    )
    .all();

  const hits: NearDuplicate[] = [];
  for (const c of candidates) {
    if (!c.phash) continue;
    const h = hammingDistance(asset.phash, c.phash);
    if (h > threshold) continue;
    hits.push({
      assetId: c.id,
      name: c.name,
      relPath: c.relPath,
      ext: c.ext,
      size: c.size,
      hamming: h,
    });
  }
  hits.sort((a, b) => a.hamming - b.hamming);
  return hits.slice(0, NEAR_DUP_LIMIT);
}

function findSizeVariants(db: Db, asset: Asset): SizeVariant[] {
  const suffix = parsePixelSuffix(asset.stem);
  const pathSize = pixelSizeFromPath(asset.dir);

  if (suffix) {
    const rows = db
      .select({ id: assets.id, stem: assets.stem, name: assets.name })
      .from(assets)
      .where(
        and(
          eq(assets.sourceId, asset.sourceId),
          eq(assets.ext, asset.ext),
          like(assets.stem, `${suffix.canonical}%`),
          ne(assets.id, asset.id),
        ),
      )
      .all();
    const variants: SizeVariant[] = [];
    for (const r of rows) {
      const s = parsePixelSuffix(r.stem);
      if (s && s.canonical === suffix.canonical) {
        variants.push({ size: s.size, assetId: r.id, name: r.name });
      }
    }
    return dedupeSizes(variants);
  }

  if (pathSize !== null) {
    const rows = db
      .select({ id: assets.id, dir: assets.dir, name: assets.name })
      .from(assets)
      .where(
        and(
          eq(assets.sourceId, asset.sourceId),
          eq(assets.ext, asset.ext),
          eq(assets.stem, asset.stem),
          ne(assets.id, asset.id),
        ),
      )
      .all();
    const variants: SizeVariant[] = [];
    for (const r of rows) {
      const s = pixelSizeFromPath(r.dir);
      if (s !== null) variants.push({ size: s, assetId: r.id, name: r.name });
    }
    return dedupeSizes(variants);
  }

  return [];
}

function dedupeSizes(variants: SizeVariant[]): SizeVariant[] {
  const seen = new Set<number>();
  const out: SizeVariant[] = [];
  for (const v of variants.sort((a, b) => a.size - b.size)) {
    if (seen.has(v.size)) continue;
    seen.add(v.size);
    out.push(v);
  }
  return out;
}

export type UsageRow = {
  id: number;
  relPath: string;
  line: number;
  snippet: string;
  commented: boolean;
};

export function listAssetUsages(
  db: Db,
  assetId: number,
  cursor: number | null,
  limit: number,
): UsageRow[] {
  return db
    .select({
      id: usages.id,
      relPath: usages.relPath,
      line: usages.line,
      snippet: usages.snippet,
      commented: usages.commented,
    })
    .from(usages)
    .where(
      cursor === null
        ? eq(usages.assetId, assetId)
        : and(eq(usages.assetId, assetId), gt(usages.id, cursor)),
    )
    .orderBy(asc(usages.id))
    .limit(limit)
    .all();
}
