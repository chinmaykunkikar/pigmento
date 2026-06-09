import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

const DB_KEY = Symbol.for("pika.db");

type DbStore = { [k: symbol]: Db | undefined };

export function getDb(dbPath = "./data/pika.db"): Db {
  const g = globalThis as unknown as DbStore;
  let instance = g[DB_KEY];
  if (instance) return instance;
  const abs = resolve(process.cwd(), dbPath);
  mkdirSync(dirname(abs), { recursive: true });
  const sqlite = new Database(abs);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  instance = drizzle(sqlite, { schema });
  g[DB_KEY] = instance;
  return instance;
}
