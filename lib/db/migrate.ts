import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Db } from "./client";

const migrated = new Set<string>();

// migrate.ts is co-located with the migrations dir in both dev (lib/db/migrations)
// and the esbuild CLI bundle (dist/migrations), so import.meta.dirname + "migrations"
// resolves correctly in both without a bundled-path flag. Computed lazily and guarded:
// a runtime that doesn't populate import.meta.dirname (or a Next build that didn't trace
// the .sql files) skips silently and relies on out-of-band migration, never crashing.
function migrationsFolder(): string | null {
  const dir = import.meta.dirname;
  if (!dir) return null;
  const folder = resolve(dir, "migrations");
  return existsSync(folder) ? folder : null;
}

export function ensureMigrated(dbPath: string, db: Db): void {
  if (migrated.has(dbPath)) return;
  const folder = migrationsFolder();
  if (folder) migrate(db, { migrationsFolder: folder });
  migrated.add(dbPath);
}
