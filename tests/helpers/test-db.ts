import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export type TestDb = {
  db: Db;
  sqlite: Database.Database;
  dir: string;
  cleanup: () => void;
};

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../../lib/db/migrations");

export function createTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), "pika-test-"));
  const sqlite = new Database(join(dir, "test.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db,
    sqlite,
    dir,
    cleanup: () => {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function seedSource(db: Db, root = "/tmp/pika-fixture-source"): schema.Source {
  const [row] = db.insert(schema.sources).values({ root, label: "fixture" }).returning().all();
  if (!row) throw new Error("failed to seed source");
  return row;
}

type AssetSeed = Partial<schema.NewAsset> & { name: string };

export function seedAsset(db: Db, sourceId: number, seed: AssetSeed): schema.Asset {
  const stem = seed.stem ?? seed.name.replace(/\.[^.]+$/, "");
  const ext = seed.ext ?? seed.name.match(/\.([^.]+)$/)?.[1] ?? "svg";
  const relPath = seed.relPath ?? `icons/${seed.name}`;
  const values: schema.NewAsset = {
    sourceId,
    absPath: seed.absPath ?? `/tmp/pika-fixture-source/${relPath}`,
    relPath,
    dir: seed.dir ?? "icons",
    stem,
    ext,
    size: seed.size ?? 1024,
    mtime: seed.mtime ?? 1700000000000,
    contentHash: seed.contentHash ?? `hash-${seed.name}`,
    sha1: seed.sha1 ?? `sha1-${seed.name}`,
    category: seed.category ?? "icon",
    ...seed,
  };
  const [row] = db.insert(schema.assets).values(values).returning().all();
  if (!row) throw new Error(`failed to seed asset ${seed.name}`);
  return row;
}
