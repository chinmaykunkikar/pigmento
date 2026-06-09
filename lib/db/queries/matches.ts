import { and, count, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { jaccard, sharedTokens, tokenize } from "@/lib/indexer/name-tokens";
import { hamming, isDegeneratePhash, SVG_NEAR_THRESHOLD } from "@/lib/indexer/phash";
import { cosine } from "@/lib/match/clip";
import type { QuerySignature } from "@/lib/match/ext";
import { percentileOf, semanticGate } from "@/lib/match/semantic";
import type { Db } from "../client";
import { assets, usages } from "../schema";

export const NEAR_HAMMING_CEILING = 20;
export const NEAR_HAMMING_DEFAULT = 12;
const NAME_JACCARD_MIN = 0.33;
const LIMIT_EXACT = 10;
const LIMIT_NEAR = 30;
const LIMIT_NAME = 10;
const LIMIT_SEMANTIC = 10;

export type MatchRow = {
  assetId: number;
  name: string;
  relPath: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  strokeWidths: string | null;
  usageCount: number;
};

export type ExactMatch = MatchRow;

export type NearMatch = MatchRow & {
  hamming: number;
  pct: number;
};

export type NameMatch = MatchRow & {
  score: number;
  sharedTokens: string[];
};

export type SemanticMatch = MatchRow & {
  score: number;
  percentile: number;
};

export type MatchBuckets = {
  exact: ExactMatch[];
  near: NearMatch[];
  nearDegenerateQuery: boolean;
  name: NameMatch[];
  semantic: SemanticMatch[];
};

export function findMatches(
  db: Db,
  sourceId: number,
  signature: QuerySignature,
  queryEmbedding: Float32Array | null,
): MatchBuckets {
  const exact = findExact(db, sourceId, signature.contentHash);
  const exactIds = new Set(exact.map((m) => m.assetId));
  const nearDegenerateQuery = signature.phash !== null && isDegeneratePhash(signature.phash);
  const near = nearDegenerateQuery
    ? []
    : findNear(db, sourceId, signature.ext, signature.phash, exactIds);
  const nearIds = new Set(near.map((m) => m.assetId));
  const nameExclude = new Set([...exactIds, ...nearIds]);
  const name = findNameCluster(db, sourceId, signature.stem, nameExclude);
  const nameIds = new Set(name.map((m) => m.assetId));
  const semanticExclude = new Set([...exactIds, ...nearIds, ...nameIds]);
  const semantic = findSemantic(db, sourceId, queryEmbedding, semanticExclude);

  const allIds = [
    ...exact.map((m) => m.assetId),
    ...near.map((m) => m.assetId),
    ...name.map((m) => m.assetId),
    ...semantic.map((m) => m.assetId),
  ];
  const usageBy = countUsages(db, allIds);
  applyUsage(exact, usageBy);
  applyUsage(near, usageBy);
  applyUsage(name, usageBy);
  applyUsage(semantic, usageBy);

  return { exact, near, nearDegenerateQuery, name, semantic };
}

function countUsages(db: Db, assetIds: number[]): Map<number, number> {
  if (assetIds.length === 0) return new Map();
  const rows = db
    .select({ assetId: usages.assetId, n: count() })
    .from(usages)
    .where(inArray(usages.assetId, assetIds))
    .groupBy(usages.assetId)
    .all();
  return new Map(rows.map((r) => [r.assetId, Number(r.n)]));
}

function applyUsage<T extends MatchRow>(rows: T[], usage: Map<number, number>) {
  for (const r of rows) r.usageCount = usage.get(r.assetId) ?? 0;
}

function findExact(db: Db, sourceId: number, contentHash: string): ExactMatch[] {
  const rows = db
    .select({
      assetId: assets.id,
      name: assets.name,
      relPath: assets.relPath,
      ext: assets.ext,
      size: assets.size,
      width: assets.width,
      height: assets.height,
      dominantColor: assets.dominantColor,
      strokeWidths: assets.strokeWidths,
    })
    .from(assets)
    .where(and(eq(assets.sourceId, sourceId), eq(assets.contentHash, contentHash)))
    .limit(LIMIT_EXACT)
    .all();
  return rows.map((r) => ({ ...r, usageCount: 0 }));
}

function findNear(
  db: Db,
  sourceId: number,
  ext: string,
  queryPhash: string | null,
  exclude: Set<number>,
): NearMatch[] {
  if (!queryPhash) return [];
  const ceiling = ext === "svg" ? SVG_NEAR_THRESHOLD : NEAR_HAMMING_CEILING;
  const candidates = db
    .select({
      assetId: assets.id,
      name: assets.name,
      relPath: assets.relPath,
      ext: assets.ext,
      size: assets.size,
      phash: assets.phash,
      width: assets.width,
      height: assets.height,
      dominantColor: assets.dominantColor,
      strokeWidths: assets.strokeWidths,
    })
    .from(assets)
    .where(and(eq(assets.sourceId, sourceId), eq(assets.ext, ext)))
    .all();

  const hits: NearMatch[] = [];
  for (const c of candidates) {
    if (exclude.has(c.assetId)) continue;
    if (!c.phash) continue;
    if (isDegeneratePhash(c.phash)) continue;
    const h = hamming(queryPhash, c.phash);
    if (h > ceiling) continue;
    hits.push({
      assetId: c.assetId,
      name: c.name,
      relPath: c.relPath,
      ext: c.ext,
      size: c.size,
      width: c.width,
      height: c.height,
      dominantColor: c.dominantColor,
      strokeWidths: c.strokeWidths,
      usageCount: 0,
      hamming: h,
      // capped at 99: equal phash is not equal content; 100% belongs to the exact bucket
      pct: Math.min(99, Math.round(((64 - h) / 64) * 100)),
    });
  }
  hits.sort((a, b) => a.hamming - b.hamming);
  return hits.slice(0, LIMIT_NEAR);
}

function findNameCluster(
  db: Db,
  sourceId: number,
  stem: string,
  exclude: Set<number>,
): NameMatch[] {
  const tokens = tokenize(stem);
  if (tokens.size === 0) return [];

  const candidates = db
    .select({
      assetId: assets.id,
      name: assets.name,
      relPath: assets.relPath,
      ext: assets.ext,
      size: assets.size,
      stem: assets.stem,
      width: assets.width,
      height: assets.height,
      dominantColor: assets.dominantColor,
      strokeWidths: assets.strokeWidths,
    })
    .from(assets)
    .where(and(eq(assets.sourceId, sourceId), ne(assets.name, stem)))
    .all();

  const hits: NameMatch[] = [];
  for (const c of candidates) {
    if (exclude.has(c.assetId)) continue;
    const other = tokenize(c.stem);
    const shared = sharedTokens(tokens, other);
    if (shared.length === 0) continue;
    const score = jaccard(tokens, other);
    if (score < NAME_JACCARD_MIN) continue;
    hits.push({
      assetId: c.assetId,
      name: c.name,
      relPath: c.relPath,
      ext: c.ext,
      size: c.size,
      width: c.width,
      height: c.height,
      dominantColor: c.dominantColor,
      strokeWidths: c.strokeWidths,
      usageCount: 0,
      score,
      sharedTokens: shared,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, LIMIT_NAME);
}

function findSemantic(
  db: Db,
  sourceId: number,
  queryEmbedding: Float32Array | null,
  exclude: Set<number>,
): SemanticMatch[] {
  if (!queryEmbedding) return [];
  const candidates = db
    .select({
      assetId: assets.id,
      name: assets.name,
      relPath: assets.relPath,
      ext: assets.ext,
      size: assets.size,
      width: assets.width,
      height: assets.height,
      dominantColor: assets.dominantColor,
      strokeWidths: assets.strokeWidths,
      embedding: assets.clipEmbedding,
    })
    .from(assets)
    .where(and(eq(assets.sourceId, sourceId), isNotNull(assets.clipEmbedding)))
    .all();

  const scored: { row: (typeof candidates)[number]; score: number }[] = [];
  for (const c of candidates) {
    if (exclude.has(c.assetId)) continue;
    if (!c.embedding) continue;
    scored.push({ row: c, score: cosine(queryEmbedding, c.embedding) });
  }

  const allScores = scored.map((s) => s.score);
  const gate = semanticGate(allScores);
  const sortedScores = [...allScores].sort((a, b) => a - b);

  const hits: SemanticMatch[] = [];
  for (const { row, score } of scored) {
    if (score < gate) continue;
    hits.push({
      assetId: row.assetId,
      name: row.name,
      relPath: row.relPath,
      ext: row.ext,
      size: row.size,
      width: row.width,
      height: row.height,
      dominantColor: row.dominantColor,
      strokeWidths: row.strokeWidths,
      usageCount: 0,
      score,
      percentile: percentileOf(sortedScores, score),
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, LIMIT_SEMANTIC);
}
