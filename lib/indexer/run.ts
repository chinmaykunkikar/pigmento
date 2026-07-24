import { readFile, stat } from "node:fs/promises";
import { eq } from "drizzle-orm";
import pLimit from "p-limit";
import type { Config } from "../config/schema";
import type { Db } from "../db/client";
import { type Asset, assets, type NewAsset, type Source, sources } from "../db/schema";
import { FailureLog } from "./attempt";
import { categorize } from "./category";
import { runClipStage } from "./clip";
import { hashCluster } from "./cluster-hash";
import { nameCluster } from "./cluster-name";
import { phashCluster } from "./cluster-phash";
import { rebuildClusters } from "./cluster-store";
import { dominantColor } from "./color";
import { clusterColors } from "./color-cluster";
import { extractColors } from "./color-extract";
import { deleteMissing } from "./delete";
import { emitStage } from "./events";
import { ensureFts, ensureViews, rebuildFts } from "./fts";
import { gitAuthor } from "./git";
import { hashBuffer } from "./hash";
import { backfillPhashPopcount } from "./hygiene";
import { getMeta } from "./meta";
import { computePhash, popcountHex } from "./phash";
import { Progress } from "./progress";
import { acquireRun, completeRun } from "./run-registry";
import { scan } from "./scan";
import { rebuildStyleClusters } from "./style-cluster-store";
import { rebuildStyleUsages } from "./style-usage-store";
import { parseSvg } from "./svg";
import { clusterTypography, type TypeValueCount } from "./type-cluster";
import { extractTypography } from "./type-extract";
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
  // where stage progress prints; defaults to stdout (CLI). The MCP/check paths
  // pass a silent writer so cold-start progress never lands on the JSON-RPC or
  // --json stdout stream.
  progressWrite?: (s: string) => void;
};

// Acquires the cross-process index_runs sentinel synchronously (throws
// RunActiveError) so HTTP routes can 409 before any work starts, then runs
// detached. The CLI awaits the promise; the web routes return 202.
export function startIndexerRun(opts: IndexerOptions): { promise: Promise<void> } {
  const runId = acquireRun(opts.db, opts.source.id);
  return { promise: executeRun(opts, runId) };
}

export async function runIndexer(opts: IndexerOptions): Promise<void> {
  await startIndexerRun(opts).promise;
}

async function executeRun(opts: IndexerOptions, runId: number): Promise<void> {
  const { db, source } = opts;
  const sourceId = source.id;
  const runStart = Date.now();
  try {
    await runStages(opts);
    completeRun(db, runId, "done");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    completeRun(db, runId, "error", message);
    emitStage({ type: "run-error", sourceId, ms: Date.now() - runStart, error: message });
    throw err;
  }
}

async function assertRootExists(root: string): Promise<void> {
  const st = await stat(root).catch(() => null);
  if (!st || !st.isDirectory()) {
    throw new Error(`source root is missing or not a directory: ${root}`);
  }
}

async function runStages(opts: IndexerOptions): Promise<void> {
  const { db, source, config, full } = opts;
  const progress = new Progress(opts.progressWrite);
  const sourceId = source.id;
  const runStart = Date.now();

  emitStage({ type: "run-start", sourceId, label: source.label });

  // a vanished root must abort, not scan to zero files and prune every row
  await assertRootExists(source.root);

  ensureFts(db);
  ensureViews(db);

  const scanned = await stage(progress, sourceId, "scan", async () => {
    const files = await scan(source.root, {
      extensions: config.extensions,
      ignore: config.ignore,
    });
    return { result: files, detail: `${files.length} files` };
  });

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
    const failures = new FailureLog();
    const rows = await Promise.all(
      toProcess.map((f) =>
        limit(async (): Promise<NewAsset | null> => {
          const buf = await failures.attempt("read", f.relPath, () => readFile(f.absPath));
          if (!buf) return null;
          const hashRes = await failures.attempt("hash", f.relPath, () => hashBuffer(buf));
          if (!hashRes) return null;
          const [meta, phash, dom] = await Promise.all([
            failures.attempt("meta", f.relPath, () => getMeta(buf, f.ext)),
            failures.attempt("phash", f.relPath, () => computePhash(buf, f.ext)),
            failures.attempt("color", f.relPath, () => dominantColor(buf, f.ext)),
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
            width: meta?.width ?? null,
            height: meta?.height ?? null,
            category: categorize(f.ext, meta?.width ?? null, meta?.height ?? null),
            phash: phash ?? null,
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
    const okRows = rows.filter((r): r is NewAsset => r !== null);
    const detail =
      failures.size === 0
        ? `${okRows.length} files`
        : `${okRows.length} files, ${failures.summary()}`;
    return { result: okRows, detail, failures: failures.sample() };
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
      return { result: res, detail: "disabled (set clip.enabled in pigmento.config.ts)" };
    }
    if (res.skippedModelUnavailable) {
      return { result: res, detail: `model unavailable, skipped (${res.modelError})` };
    }
    const parts = [`${res.embedded} embedded`];
    if (res.degenerate > 0) parts.push(`${res.degenerate} degenerate`);
    if (res.failed > 0) parts.push(res.failures.summary());
    return {
      result: res,
      detail: `${parts.join(", ")} of ${res.processed} targeted`,
      failures: res.failures.sample(),
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

  const colorHits = await softStage(progress, sourceId, "color-extract", async () => {
    // purge-on-failure (OV-1b): a throw before the rebuild would otherwise leave
    // the prior run's rows reading as stale-fresh, so empty the kind instead.
    try {
      const hits = await extractColors({
        sourceId,
        codeRoots: [source.root, ...config.codeRoots],
        ignore: config.ignore,
        assets: allAssets,
      });
      const n = rebuildStyleUsages(db, sourceId, "color", hits);
      const resolved = hits.filter((h) => h.normalizedValue !== null).length;
      return { result: hits, detail: `${n} usages, ${resolved} resolved` };
    } catch (err) {
      rebuildStyleUsages(db, sourceId, "color", []);
      throw err;
    }
  });

  if (colorHits) {
    await softStage(progress, sourceId, "color-cluster", () => {
      try {
        const counts = new Map<string, number>();
        for (const h of colorHits) {
          if (!h.normalizedValue) continue;
          counts.set(h.normalizedValue, (counts.get(h.normalizedValue) ?? 0) + 1);
        }
        const clusters = clusterColors([...counts].map(([color, count]) => ({ color, count })));
        const n = rebuildStyleClusters(db, sourceId, "color", clusters);
        const neutral = clusters.filter((c) => c.neutral).length;
        return { result: n, detail: `${n} near-miss clusters (${neutral} neutral)` };
      } catch (err) {
        rebuildStyleClusters(db, sourceId, "color", []);
        throw err;
      }
    });
  }

  const typeHits = await softStage(progress, sourceId, "type-extract", async () => {
    try {
      const hits = await extractTypography({
        sourceId,
        codeRoots: [source.root, ...config.codeRoots],
        ignore: config.ignore,
      });
      const n = rebuildStyleUsages(db, sourceId, "type", hits);
      const resolved = hits.filter((h) => h.normalizedValue !== null).length;
      return { result: hits, detail: `${n} usages, ${resolved} resolved` };
    } catch (err) {
      rebuildStyleUsages(db, sourceId, "type", []);
      throw err;
    }
  });

  if (typeHits) {
    await softStage(progress, sourceId, "type-cluster", () => {
      try {
        const counts = new Map<string, TypeValueCount>();
        for (const h of typeHits) {
          const axis = h.axis;
          if (!h.normalizedValue || (axis !== "size" && axis !== "family")) continue;
          const key = `${axis} ${h.normalizedValue}`;
          const cur = counts.get(key);
          if (cur) cur.count++;
          else counts.set(key, { axis, value: h.normalizedValue, count: 1 });
        }
        const clusters = clusterTypography([...counts.values()]);
        const n = rebuildStyleClusters(db, sourceId, "type", clusters);
        return { result: n, detail: `${n} near-miss clusters` };
      } catch (err) {
        rebuildStyleClusters(db, sourceId, "type", []);
        throw err;
      }
    });
  }

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

type StageOutput<T> = {
  result: T;
  detail: string;
  failures?: { label: string; file: string; reason: string }[];
};

async function stage<T>(
  progress: Progress,
  sourceId: number,
  name: string,
  fn: () => Promise<StageOutput<T>> | StageOutput<T>,
): Promise<T> {
  progress.start(name);
  emitStage({ type: "stage-start", sourceId, stage: name });
  const t0 = Date.now();
  const { result, detail, failures } = await fn();
  const ms = Date.now() - t0;
  progress.end(name, detail);
  emitStage({
    type: "stage-end",
    sourceId,
    stage: name,
    detail,
    ms,
    ...(failures && failures.length > 0 ? { failures } : {}),
  });
  return result;
}

// Non-fatal stage (design S2): a throw marks the stage failed-and-skipped with
// observable detail, and the rest of the run continues. Style stages use this
// so a color-extraction bug never aborts a completed image index.
async function softStage<T>(
  progress: Progress,
  sourceId: number,
  name: string,
  fn: () => Promise<StageOutput<T>> | StageOutput<T>,
): Promise<T | null> {
  progress.start(name);
  emitStage({ type: "stage-start", sourceId, stage: name });
  const t0 = Date.now();
  try {
    const { result, detail, failures } = await fn();
    progress.end(name, detail);
    emitStage({
      type: "stage-end",
      sourceId,
      stage: name,
      detail,
      ms: Date.now() - t0,
      ...(failures && failures.length > 0 ? { failures } : {}),
    });
    return result;
  } catch (err) {
    const detail = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    progress.end(name, detail);
    emitStage({ type: "stage-end", sourceId, stage: name, detail, ms: Date.now() - t0 });
    return null;
  }
}
