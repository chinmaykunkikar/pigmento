import { and, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { indexerEvents, type StageEvent } from "@/lib/indexer/events";

export type EmbeddingCandidate = {
  assetId: number;
  name: string;
  relPath: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  strokeWidths: string | null;
  embedding: Float32Array;
};

const CACHE_KEY = Symbol.for("pika.embeddingCache");

type CacheStore = { [k: symbol]: Map<number, EmbeddingCandidate[]> | undefined };

function cache(): Map<number, EmbeddingCandidate[]> {
  const g = globalThis as unknown as CacheStore;
  let map = g[CACHE_KEY];
  if (!map) {
    map = new Map();
    g[CACHE_KEY] = map;
    wireInvalidation();
  }
  return map;
}

// every write path to embeddings goes through an index run (clip stage,
// delete-missing, content-change resets), so run completion is the natural
// invalidation point; run-error too, since a failed run may have partially
// embedded before dying
let wired = false;
function wireInvalidation() {
  if (wired) return;
  wired = true;
  indexerEvents().on("event", (ev: StageEvent) => {
    if (ev.type === "run-end" || ev.type === "run-error") {
      invalidateEmbeddingCache(ev.sourceId);
    }
  });
}

export function invalidateEmbeddingCache(sourceId?: number): void {
  if (sourceId === undefined) {
    cache().clear();
    return;
  }
  cache().delete(sourceId);
}

export function getEmbeddingCandidates(db: Db, sourceId: number): EmbeddingCandidate[] {
  const hit = cache().get(sourceId);
  if (hit) return hit;
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
      embedding: assets.clipEmbedding,
    })
    .from(assets)
    .where(
      and(
        eq(assets.sourceId, sourceId),
        isNotNull(assets.clipEmbedding),
        or(isNull(assets.embedStatus), ne(assets.embedStatus, "degenerate")),
      ),
    )
    .all();
  const candidates: EmbeddingCandidate[] = [];
  for (const r of rows) {
    if (!r.embedding) continue;
    candidates.push({ ...r, embedding: r.embedding });
  }
  cache().set(sourceId, candidates);
  return candidates;
}

export type ClipHealth = {
  ok: number;
  failed: number;
  degenerate: number;
  degraded: boolean;
};

const DEGRADED_FAILURE_RATE = 0.2;

export function clipHealth(db: Db, sourceId: number): ClipHealth {
  const rows = db
    .select({ embedStatus: assets.embedStatus })
    .from(assets)
    .where(and(eq(assets.sourceId, sourceId), isNotNull(assets.embedStatus)))
    .all();
  let ok = 0;
  let failed = 0;
  let degenerate = 0;
  for (const r of rows) {
    if (r.embedStatus === "ok") ok++;
    else if (r.embedStatus === "failed") failed++;
    else if (r.embedStatus === "degenerate") degenerate++;
  }
  const total = ok + failed + degenerate;
  return {
    ok,
    failed,
    degenerate,
    degraded: total > 0 && failed / total > DEGRADED_FAILURE_RATE,
  };
}
