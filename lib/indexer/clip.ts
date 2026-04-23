import { readFile } from "node:fs/promises";
import { and, eq, isNull } from "drizzle-orm";
import pLimit from "p-limit";
import type { Db } from "../db/client";
import { assets } from "../db/schema";
import { embedImage, getClipImageEncoder } from "../match/clip";

const CONCURRENCY = 4;

export type ClipStageResult = {
  processed: number;
  embedded: number;
  failed: number;
  skippedModelUnavailable: boolean;
  skippedDisabled: boolean;
};

export async function runClipStage(
  db: Db,
  sourceId: number,
  opts: { full: boolean; enabled: boolean },
): Promise<ClipStageResult> {
  if (!opts.enabled) {
    return {
      processed: 0,
      embedded: 0,
      failed: 0,
      skippedModelUnavailable: false,
      skippedDisabled: true,
    };
  }
  const rows = loadTargets(db, sourceId, opts.full);
  if (rows.length === 0) {
    return {
      processed: 0,
      embedded: 0,
      failed: 0,
      skippedModelUnavailable: false,
      skippedDisabled: false,
    };
  }

  try {
    await getClipImageEncoder();
  } catch {
    return {
      processed: rows.length,
      embedded: 0,
      failed: 0,
      skippedModelUnavailable: true,
      skippedDisabled: false,
    };
  }

  const limit = pLimit(CONCURRENCY);
  let embedded = 0;
  let failed = 0;

  await Promise.all(
    rows.map((row) =>
      limit(async () => {
        const buf = await readFile(row.absPath).catch(() => null);
        if (!buf) {
          failed++;
          return;
        }
        const vec = await embedImage(buf, row.ext);
        if (!vec) {
          failed++;
          return;
        }
        db.update(assets).set({ clipEmbedding: vec }).where(eq(assets.id, row.id)).run();
        embedded++;
      }),
    ),
  );

  return {
    processed: rows.length,
    embedded,
    failed,
    skippedModelUnavailable: false,
    skippedDisabled: false,
  };
}

function loadTargets(
  db: Db,
  sourceId: number,
  full: boolean,
): { id: number; absPath: string; ext: string }[] {
  const base = db.select({ id: assets.id, absPath: assets.absPath, ext: assets.ext }).from(assets);
  if (full) {
    return base.where(eq(assets.sourceId, sourceId)).all();
  }
  return base.where(and(eq(assets.sourceId, sourceId), isNull(assets.clipEmbedding))).all();
}
