import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import pLimit from "p-limit";
import type { Config } from "../config/schema";
import type { Db } from "../db/client";
import { assets, type NewAsset, type Source } from "../db/schema";
import { categorize } from "./category";
import { deleteMissing } from "./delete";
import { ensureFts, rebuildFts } from "./fts";
import { hashBuffer } from "./hash";
import { getMeta } from "./meta";
import { Progress } from "./progress";
import { scan } from "./scan";
import { bulkUpsert } from "./upsert";

const HASH_CONCURRENCY = 16;

export type IndexerOptions = {
  db: Db;
  source: Source;
  config: Config;
  full: boolean;
};

export async function runIndexer(opts: IndexerOptions): Promise<void> {
  const { db, source, config, full } = opts;
  const progress = new Progress();

  ensureFts(db);

  progress.start("scan");
  const scanned = await scan(source.root, {
    extensions: config.extensions,
    ignore: config.ignore,
  });
  progress.end("scan", `${scanned.length} files`);

  if (full) {
    progress.start("purge");
    const changes = deleteMissing(db, source.id, []);
    progress.end("purge", `${changes} rows`);
  }

  progress.start("diff");
  const existing = new Map<string, { size: number; mtime: number }>();
  if (!full) {
    const rows = db
      .select({ absPath: assets.absPath, size: assets.size, mtime: assets.mtime })
      .from(assets)
      .where(eq(assets.sourceId, source.id))
      .all();
    for (const r of rows) existing.set(r.absPath, { size: r.size, mtime: r.mtime });
  }
  const toProcess = scanned.filter((f) => {
    const cur = existing.get(f.absPath);
    if (!cur) return true;
    return cur.size !== f.size || cur.mtime !== Math.round(f.mtime);
  });
  progress.end(
    "diff",
    `${toProcess.length} new/changed, ${scanned.length - toProcess.length} unchanged`,
  );

  progress.start("hash+meta");
  const limit = pLimit(HASH_CONCURRENCY);
  const indexed = await Promise.all(
    toProcess.map((f) =>
      limit(async (): Promise<NewAsset> => {
        const buf = await readFile(f.absPath);
        const { content, sha1 } = await hashBuffer(buf);
        const { width, height } = await getMeta(buf, f.ext);
        const category = categorize(f.ext, width, height);
        return {
          sourceId: source.id,
          absPath: f.absPath,
          relPath: f.relPath,
          dir: f.dir,
          name: f.name,
          stem: f.stem,
          ext: f.ext,
          size: f.size,
          mtime: Math.round(f.mtime),
          contentHash: content,
          sha1,
          width,
          height,
          category,
        };
      }),
    ),
  );
  progress.end("hash+meta", `${indexed.length} files`);

  progress.start("upsert");
  const inserted = bulkUpsert(db, indexed);
  progress.end("upsert", `${inserted} rows`);

  progress.start("delete-missing");
  const keep = scanned.map((f) => f.absPath);
  const deleted = deleteMissing(db, source.id, keep);
  progress.end("delete-missing", `${deleted} rows`);

  progress.start("fts");
  rebuildFts(db);
  progress.end("fts", "rebuilt");

  progress.done(`(source: ${source.label})`);
}
