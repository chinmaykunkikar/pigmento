import type { Db } from "@/lib/db/client";
import { findMatches, type MatchBuckets } from "@/lib/db/queries/matches";
import { embedImage } from "./clip";
import { normalizeExt, type QuerySignature } from "./ext";
import { computeSignature } from "./signature";

// Shared read cap for match inputs (mirrors the HTTP route). Reading + rasterizing
// an arbitrary file is CPU/memory work an agent could trigger repeatedly.
export const MAX_MATCH_BYTES = 2 * 1024 * 1024;

// The one place the "signature + optional embedding -> findMatches" dance lives.
// The CLI `match` command and the MCP find_similar_asset tool both call it, so the
// clip-toggle + degradation behaviour stays identical across surfaces.
export async function matchFile(
  db: Db,
  sourceId: number,
  buf: Buffer,
  name: string,
  clipEnabled: boolean,
): Promise<{ signature: QuerySignature; buckets: MatchBuckets }> {
  const [signature, embedding] = await Promise.all([
    computeSignature(buf, name),
    clipEnabled
      ? embedImage(buf, normalizeExt(name))
          .then((r) => r.vec)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const buckets = findMatches(db, sourceId, signature, embedding);
  return { signature, buckets };
}
