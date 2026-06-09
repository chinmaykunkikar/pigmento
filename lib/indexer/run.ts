import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import pLimit from "p-limit";
import type { Config } from "../config/schema";
import type { Db } from "../db/client";
import { type Asset, assets, type NewAsset, type Source, sources } from "../db/schema";
import { categorize } from "./category";
import { runClipStage } from "./clip";
import { hashCluster } from "./cluster-hash";
import { nameCluster } from "./cluster-name";
import { phashCluster } from "./cluster-phash";
import { rebuildClusters } from "./cluster-store";
import { dominantColor } from "./color";
import { deleteMissing } from "./delete";
import { emitStage } from "./events";
import { ensureFts, ensureViews, rebuildFts } from "./fts";
import { gitAuthor } from "./git";
import { hashBuffer } from "./hash";
import { backfillPhashPopcount } from "./hygiene";
import { getMeta } from "./meta";
import { computePhash, popcountHex } from "./phash";
import { Progress } from "./progress";
import { scan } from "./scan";
import { parseSvg } from "./svg";
import { bulkUpsert } from "./upsert";
import { scanUsages } from "./usage";
import { rebuildUsages } from "./usage-store";

const PER_FILE_CONCURRENCY = 16;
const GIT_CONCURRENCY = 8;

export type IndexerOptions = {
  db: Db;
  source: Source;
  config: Config;
  full: boolean;
};

export async function runIndexer(opts: IndexerOptions): Promise<void> {
  const { db, source, config, full } = opts;
  const progress = new Progress();
  const sourceId = source.id;
  const runStart = Date.now();

  emitStage({ type: "run-start", sourceId, label: source.label });

  ensureFts(db);
  ensureViews(db);

  const scanned = await stage(progress, sourceId, "scan", async () => {
    const files = await scan(source.root, {
      extensions: config.extensions,
      ignore: config.ignore,
    });
    return { result: files, detail: `${files.length} files` };
  });

  if (full) {
    await stage(progress, sourceId, "purge", () => {
      const changes = deleteMissing(db, sourceId, []);
      return { result: changes, detail: `${changes} rows` };
    });
  }

  const toProcess = await stage(progress, sourceId, "diff", () => {
    const existing = new Map<string, { size: number; mtime: number }>();
    if (!full) {
      const rows = db
        .select({ absPath: assets.absPath, size: assets.size, mtime: assets.mtime })
        .from(assets)
        .where(eq(assets.sourceId, sourceId))
        .all();
      for (const r of rows) existing.set(r.absPath, { size: r.size, mtime: r.mtime });
    }
    const next = scanned.filter((f) => {
      const cur = existing.get(f.absPath);
      if (!cur) return true;
      return cur.size !== f.size || cur.mtime !== Math.round(f.mtime);
    });
    return {
      result: next,
      detail: `${next.length} new/changed, ${scanned.length - next.length} unchanged`,
    };
  });

  const indexed = await stage(progress, sourceId, "hash+meta", async () => {
    const limit = pLimit(PER_FILE_CONCURRENCY);
    const rows = await Promise.all(
      toProcess.map((f) =>
        limit(async (): Promise<NewAsset> => {
          const buf = await readFile(f.absPath);
          const [hashRes, meta, phash, dom] = await Promise.all([
            hashBuffer(buf),
            getMeta(buf, f.ext),
            computePhash(buf, f.ext),
            dominantColor(buf, f.ext),
          ]);
          const svg = f.ext === "svg" ? parseSvg(buf.toString("utf8")) : null;
          return {
            sourceId,
            absPath: f.absPath,
            relPath: f.relPath,
            dir: f.dir,
            name: f.name,
            stem: f.stem,
            ext: f.ext,
            size: f.size,
            mtime: Math.round(f.mtime),
            contentHash: hashRes.content,
            sha1: hashRes.sha1,
            width: meta.width,
            height: meta.height,
            category: categorize(f.ext, meta.width, meta.height),
            phash,
            phashPopcount: phash ? popcountHex(phash) : null,
            viewBox: svg?.viewBox ?? null,
            pathsCount: svg?.pathsCount ?? null,
            commandsCount: svg?.commandsCount ?? null,
            hasFill: svg?.hasFill ?? null,
            strokeWidths: svg ? JSON.stringify(svg.strokeWidths) : null,
            literalColors: svg ? JSON.stringify(svg.literalColors) : null,
            dominantColor: dom,
          };
        }),
      ),
    );
    return { result: rows, detail: `${rows.length} files` };
  });

  await stage(progress, sourceId, "upsert", () => {
    const n = bulkUpsert(db, indexed);
    return { result: n, detail: `${n} rows` };
  });

  await stage(progress, sourceId, "delete-missing", () => {
    const keep = scanned.map((f) => f.absPath);
    const n = deleteMissing(db, sourceId, keep);
    return { result: n, detail: `${n} rows` };
  });

  await stage(progress, sourceId, "hygiene", () => {
    const n = backfillPhashPopcount(db, sourceId);
    return { result: n, detail: n === 0 ? "up to date" : `${n} backfilled` };
  });

  await stage(progress, sourceId, "git-author", async () => {
    if (indexed.length === 0) return { result: 0, detail: "skipped" };
    const limit = pLimit(GIT_CONCURRENCY);
    let hits = 0;
    await Promise.all(
      indexed.map((a) =>
        limit(async () => {
          const author = await gitAuthor(a.absPath);
          if (!author) return;
          db.update(assets).set({ author }).where(eq(assets.absPath, a.absPath)).run();
          hits++;
        }),
      ),
    );
    return { result: hits, detail: `${hits} attributed` };
  });

  const allAssets: Asset[] = await stage(progress, sourceId, "load", () => {
    const rows = db.select().from(assets).where(eq(assets.sourceId, sourceId)).all();
    return { result: rows, detail: `${rows.length} rows` };
  });

  await stage(progress, sourceId, "clip", async () => {
    const res = await runClipStage(db, sourceId, { full, enabled: config.clip.enabled });
    if (res.skippedDisabled) {
      return { result: res, detail: "disabled (set clip.enabled in pika.config.ts)" };
    }
    if (res.skippedModelUnavailable) {
      return { result: res, detail: "model unavailable, skipped" };
    }
    return {
      result: res,
      detail: `${res.embedded} embedded, ${res.failed} failed, ${res.processed} targeted`,
    };
  });

  await stage(progress, sourceId, "usage-scan", async () => {
    const hits = await scanUsages({
      sourceId,
      codeRoots: [source.root, ...config.codeRoots],
      ignore: config.ignore,
      assets: allAssets,
      maxHitsPerAsset: config.usage.maxHitsPerAsset,
    });
    const n = rebuildUsages(db, sourceId, hits);
    return { result: n, detail: `${n} hits` };
  });

  await stage(progress, sourceId, "cluster", () => {
    const nameIt = nameCluster(allAssets.map((a) => ({ id: a.id, stem: a.stem })));
    const hashIt = hashCluster(
      allAssets.map((a) => ({ id: a.id, contentHash: a.contentHash, relPath: a.relPath })),
    );
    const phashIt = phashCluster(
      allAssets
        .filter((a): a is Asset & { phash: string } => !!a.phash)
        .map((a) => ({ id: a.id, ext: a.ext, phash: a.phash })),
      config.phash.maxHamming,
    );
    const counts = rebuildClusters(db, sourceId, nameIt, hashIt, phashIt);
    return {
      result: counts,
      detail: `name=${counts.name} hash=${counts.hash} phash=${counts.phash}`,
    };
  });

  await stage(progress, sourceId, "fts", () => {
    rebuildFts(db);
    return { result: true, detail: "rebuilt" };
  });

  db.update(sources)
    .set({ lastIndexedAt: new Date().toISOString() })
    .where(eq(sources.id, sourceId))
    .run();

  const totalMs = Date.now() - runStart;
  progress.done(`(source: ${source.label})`);
  emitStage({ type: "run-end", sourceId, ms: totalMs });
}

async function stage<T>(
  progress: Progress,
  sourceId: number,
  name: string,
  fn: () => Promise<{ result: T; detail: string }> | { result: T; detail: string },
): Promise<T> {
  progress.start(name);
  emitStage({ type: "stage-start", sourceId, stage: name });
  const t0 = Date.now();
  const { result, detail } = await fn();
  const ms = Date.now() - t0;
  progress.end(name, detail);
  emitStage({ type: "stage-end", sourceId, stage: name, detail, ms });
  return result;
}
