import { readFile } from "node:fs/promises";
import { and, eq, isNull, or } from "drizzle-orm";
import pLimit from "p-limit";
import type { Db } from "../db/client";
import { assets } from "../db/schema";
import { embedImage, getClipImageEncoder } from "../match/clip";
import { FailureLog } from "./attempt";

const CONCURRENCY = 4;
const DEGENERATE_WHITE_FRACTION = 0.98;

export type ClipStageResult = {
  processed: number;
  embedded: number;
  degenerate: number;
  failed: number;
  failures: FailureLog;
  skippedModelUnavailable: boolean;
  modelError: string | null;
  skippedDisabled: boolean;
};

function emptyResult(overrides: Partial<ClipStageResult> = {}): ClipStageResult {
  return {
    processed: 0,
    embedded: 0,
    degenerate: 0,
    failed: 0,
    failures: new FailureLog(),
    skippedModelUnavailable: false,
    modelError: null,
    skippedDisabled: false,
    ...overrides,
  };
}

export async function runClipStage(
  db: Db,
  sourceId: number,
  opts: { full: boolean; enabled: boolean },
): Promise<ClipStageResult> {
  if (!opts.enabled) return emptyResult({ skippedDisabled: true });

  const rows = loadTargets(db, sourceId, opts.full);
  if (rows.length === 0) return emptyResult();

  try {
    await getClipImageEncoder();
  } catch (err) {
    return emptyResult({
      processed: rows.length,
      skippedModelUnavailable: true,
      modelError: err instanceof Error ? err.message : String(err),
    });
  }

  const limit = pLimit(CONCURRENCY);
  const failures = new FailureLog();
  let embedded = 0;
  let degenerate = 0;

  await Promise.all(
    rows.map((row) =>
      limit(async () => {
        const result = await failures.attempt("embed", row.relPath, async () => {
          const buf = await readFile(row.absPath);
          return embedImage(buf, row.ext);
        });
        if (!result) {
          db.update(assets).set({ embedStatus: "failed" }).where(eq(assets.id, row.id)).run();
          return;
        }
        const isDegenerate = result.whiteFraction >= DEGENERATE_WHITE_FRACTION;
        db.update(assets)
          .set({
            clipEmbedding: result.vec,
            rasterWhiteFraction: result.whiteFraction,
            embedStatus: isDegenerate ? "degenerate" : "ok",
          })
          .where(eq(assets.id, row.id))
          .run();
        if (isDegenerate) degenerate++;
        else embedded++;
      }),
    ),
  );

  return emptyResult({
    processed: rows.length,
    embedded,
    degenerate,
    failed: failures.size,
    failures,
  });
}

// failed rows are retried on every run; only 'ok'/'degenerate' rows are settled
function loadTargets(
  db: Db,
  sourceId: number,
  full: boolean,
): { id: number; absPath: string; relPath: string; ext: string }[] {
  const base = db
    .select({ id: assets.id, absPath: assets.absPath, relPath: assets.relPath, ext: assets.ext })
    .from(assets);
  if (full) {
    return base.where(eq(assets.sourceId, sourceId)).all();
  }
  return base
    .where(
      and(
        eq(assets.sourceId, sourceId),
        or(
          isNull(assets.clipEmbedding),
          isNull(assets.embedStatus),
          eq(assets.embedStatus, "failed"),
        ),
      ),
    )
    .all();
}
