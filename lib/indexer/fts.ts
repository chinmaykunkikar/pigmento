import { sql } from "drizzle-orm";
import type { Db } from "../db/client";

export function ensureFts(db: Db): void {
  db.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
      name, stem, rel_path,
      content='assets',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    )
  `);
}

export function rebuildFts(db: Db): void {
  db.run(sql`INSERT INTO assets_fts(assets_fts) VALUES('rebuild')`);
}

export function ensureViews(db: Db): void {
  db.run(sql`
    CREATE VIEW IF NOT EXISTS v_asset_usage AS
    SELECT a.id AS asset_id, COALESCE(COUNT(u.id), 0) AS usage_count
    FROM assets a LEFT JOIN usages u ON u.asset_id = a.id
    GROUP BY a.id
  `);
}
