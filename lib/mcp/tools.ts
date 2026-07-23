import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve, sep } from "node:path";
import type { Config } from "@/lib/config/schema";
import type { Db } from "@/lib/db/client";
import {
  derivePalette,
  getColorStats,
  getResolveCandidates,
  listColorDrift,
  resolveColorToken,
} from "@/lib/db/queries/colors";
import type { MatchBuckets } from "@/lib/db/queries/matches";
import { getTypographyScale, listTypeDrift } from "@/lib/db/queries/typography";
import type { Source } from "@/lib/db/schema";
import { normalizeColor } from "@/lib/indexer/color-normalize";
import { isAllowedExt } from "@/lib/match/ext";
import { MAX_MATCH_BYTES, matchFile } from "@/lib/match/find";
import { err, ok } from "./envelope";
import { realpathOrSelf } from "./repo";

export function getPalette(db: Db, sourceId: number) {
  const stats = getColorStats(db, sourceId);
  return ok({ palette: derivePalette(stats), coverage: stats.coverage });
}

export function resolveTokenForValue(db: Db, sourceId: number, input: { value: string }) {
  const parsed = normalizeColor(input.value);
  if (!parsed) {
    return err(
      "invalid_input",
      `could not parse "${input.value}" as a CSS color`,
      "pass a resolvable color like #1c7a74 or rgb(28,122,116); var()/color-mix() cannot be resolved",
    );
  }
  const candidates = getResolveCandidates(db, sourceId);
  if (candidates.length === 0) {
    return ok({
      within: false,
      nearest: null,
      deltaE: null,
      note: "no colors indexed in this repo",
    });
  }
  return ok(resolveColorToken(parsed.color, candidates));
}

export function getTypographyScaleTool(db: Db, sourceId: number) {
  return ok({ scale: getTypographyScale(db, sourceId) });
}

// Kind-split schema by construction: color drift carries suggestedToken; type
// drift does not (type var-defs are not extracted in v1).
export function listDriftTool(
  db: Db,
  sourceId: number,
  input: { kind?: "color" | "type"; topN?: number },
) {
  const topN = clamp(input.topN ?? 10, 1, 100);
  const out: { color?: unknown[]; type?: unknown[] } = {};
  if (input.kind !== "type") out.color = listColorDrift(db, sourceId).slice(0, topN);
  if (input.kind !== "color") out.type = listTypeDrift(db, sourceId).slice(0, topN);
  return ok({ ...out });
}

export async function findSimilarAsset(
  db: Db,
  source: Source,
  config: Config,
  input: { path: string; topN?: number },
) {
  const topN = clamp(input.topN ?? 10, 1, 50);
  const abs = safePath(input.path, source.root);
  if (!abs) {
    return err(
      "invalid_input",
      "path is not under an indexed source or the OS temp dir",
      "pass a file inside the repo or the OS temp dir",
    );
  }
  if (!isAllowedExt(abs)) {
    return err("unsupported", "unsupported file type", "supported: svg, png, jpg, jpeg, webp, gif");
  }
  const st = await stat(abs).catch(() => null);
  if (!st?.isFile()) {
    return err("invalid_input", "path is not a readable file", "pass an existing image file");
  }
  if (st.size > MAX_MATCH_BYTES) {
    return err(
      "invalid_input",
      `file exceeds ${MAX_MATCH_BYTES / 1024 / 1024} MB`,
      "pass a smaller file",
    );
  }
  const buf = await readFile(abs);
  const { buckets } = await matchFile(db, source.id, buf, basename(abs), config.clip.enabled);
  return ok({ clipEnabled: config.clip.enabled, matches: mergeTopN(buckets, topN) });
}

// realpath the input and the roots so a symlink under the repo pointing outside is
// rejected. A path outside the boundary returns null with the same message whether
// or not it exists (existence-indistinguishable).
function safePath(input: string, sourceRoot: string): string | null {
  // Both raw and realpathed roots, so a symlinked temp dir (macOS /var -> /private/var)
  // still matches an in-bounds file while a symlink escaping the root is caught.
  const roots = [
    ...new Set([sourceRoot, realpathOrSelf(sourceRoot), tmpdir(), realpathOrSelf(tmpdir())]),
  ];
  const abs = resolve(input);
  if (!underAny(abs, roots)) return null; // lexically outside the boundary
  if (!underAny(realpathOrSelf(abs), roots)) return null; // symlink escapes the boundary
  return abs;
}

function underAny(p: string, roots: string[]): boolean {
  return roots.some((r) => p === r || p.startsWith(r + sep));
}

type Similar = { relPath: string; name: string; score: number; via: string; usageCount: number };

function mergeTopN(b: MatchBuckets, topN: number): Similar[] {
  const byId = new Map<number, Similar>();
  const add = (
    m: { assetId: number; name: string; relPath: string; usageCount: number },
    score: number,
    via: string,
  ) => {
    const cur = byId.get(m.assetId);
    if (!cur || score > cur.score) {
      byId.set(m.assetId, {
        relPath: m.relPath,
        name: m.name,
        score,
        via,
        usageCount: m.usageCount,
      });
    }
  };
  for (const m of b.exact) add(m, 1, "exact");
  for (const m of b.near) add(m, m.pct / 100, "phash");
  for (const m of b.name) add(m, m.score, "name");
  for (const m of b.semantic) add(m, m.score, "semantic");
  return [...byId.values()]
    .sort((a, z) => z.score - a.score || (a.relPath < z.relPath ? -1 : 1))
    .slice(0, topN);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
