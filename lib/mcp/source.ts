import { basename, resolve as pathResolve } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { loadConfig } from "@/lib/config/load";
import { type Config, ConfigSchema } from "@/lib/config/schema";
import { type Db, getDb } from "@/lib/db/client";
import { addSource, listSources } from "@/lib/db/queries/sources";
import type { Source } from "@/lib/db/schema";
import { indexerEvents, type StageEvent } from "@/lib/indexer/events";
import { runIndexer } from "@/lib/indexer/run";
import { RunActiveError } from "@/lib/indexer/run-registry";
import { repoRootOf } from "./repo";

const MIGRATIONS_FOLDER = pathResolve(import.meta.dirname, "../db/migrations");
const migrated = new Set<string>();
const inflight = new Map<string, Promise<void>>();
const configCache = new Map<string, Config>();

export class NotIndexedError extends Error {
  readonly code = "not_indexed";
  constructor(
    message: string,
    readonly remedy: string,
  ) {
    super(message);
    this.name = "NotIndexedError";
  }
}

export class IndexFailedError extends Error {
  readonly code = "index_failed";
  readonly remedy = "run `pigmento index` to see stage output, then retry";
  constructor(
    message: string,
    readonly stage?: string,
  ) {
    super(message);
    this.name = "IndexFailedError";
  }
}

export type ResolvedRepo = {
  db: Db;
  source: Source;
  config: Config;
  dbPath: string;
  coldStarted: boolean;
};

// Resolves the mounted repo (git top-level of cwd) to its one source row, cold-
// starting a synchronous index (D4.3) when the repo has never been indexed. Shared
// by the MCP server, `check`, and `context`.
export async function resolveRepoSource(
  opts: { cwd?: string; onProgress?: (ev: StageEvent) => void } = {},
): Promise<ResolvedRepo> {
  const root = repoRootOf(opts.cwd ?? process.cwd());
  const dbPath = `${root}/data/pika.db`;
  const db = getDb(dbPath);
  ensureMigrated(dbPath, db);
  const config = await getConfig(root);

  const existing = findByRoot(db, root);
  if (existing?.lastIndexedAt) {
    return { db, source: existing, config, dbPath, coldStarted: false };
  }

  await coldStart(db, root, existing ?? null, config, opts.onProgress);
  const source = findByRoot(db, root);
  if (!source) throw new IndexFailedError("index completed but the source row is missing");
  return { db, source, config, dbPath, coldStarted: true };
}

function findByRoot(db: Db, root: string): Source | undefined {
  return listSources(db).find((s) => s.root === root);
}

// getDb() opens the file but never runs migrations (only tests did). A cold-start
// into a fresh repo would have no schema — migrate once per db path.
function ensureMigrated(dbPath: string, db: Db): void {
  if (migrated.has(dbPath)) return;
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  migrated.add(dbPath);
}

async function getConfig(root: string): Promise<Config> {
  const hit = configCache.get(root);
  if (hit) return hit;
  const config = await loadConfig(root).catch(() => ConfigSchema.parse({}));
  configCache.set(root, config);
  return config;
}

// In-process coalescing: two concurrent first tool calls share one index promise
// instead of the second hitting the cross-process RunActiveError sentinel.
function coldStart(
  db: Db,
  root: string,
  existing: Source | null,
  config: Config,
  onProgress?: (ev: StageEvent) => void,
): Promise<void> {
  const running = inflight.get(root);
  if (running) return running;
  const promise = doIndex(db, root, existing, config, onProgress).finally(() =>
    inflight.delete(root),
  );
  inflight.set(root, promise);
  return promise;
}

export async function doIndex(
  db: Db,
  root: string,
  existing: Source | null,
  config: Config,
  onProgress?: (ev: StageEvent) => void,
): Promise<void> {
  const source = existing ?? addSource(db, { root, label: basename(root) });
  const bus = indexerEvents();
  const listener = (ev: StageEvent) => {
    if (ev.sourceId === source.id) onProgress?.(ev);
  };
  bus.on("event", listener);
  try {
    await runIndexer({ db, source, config, full: false });
  } catch (e) {
    if (e instanceof RunActiveError) {
      throw new NotIndexedError(
        "an index run is already active for this repo",
        "another process is indexing; retry in a few seconds",
      );
    }
    throw new IndexFailedError(e instanceof Error ? e.message : String(e));
  } finally {
    bus.off("event", listener);
  }
}
