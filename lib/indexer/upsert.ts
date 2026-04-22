import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { assets, type NewAsset } from "../db/schema";

const BATCH_SIZE = 500;

const EXCLUDED_SET = {
  size: sql`excluded.size`,
  mtime: sql`excluded.mtime`,
  contentHash: sql`excluded.content_hash`,
  sha1: sql`excluded.sha1`,
  width: sql`excluded.width`,
  height: sql`excluded.height`,
  category: sql`excluded.category`,
  stem: sql`excluded.stem`,
  dir: sql`excluded.dir`,
  relPath: sql`excluded.rel_path`,
  name: sql`excluded.name`,
  ext: sql`excluded.ext`,
  phash: sql`excluded.phash`,
  viewBox: sql`excluded.view_box`,
  pathsCount: sql`excluded.paths_count`,
  commandsCount: sql`excluded.commands_count`,
  hasFill: sql`excluded.has_fill`,
  strokeWidths: sql`excluded.stroke_widths`,
  literalColors: sql`excluded.literal_colors`,
  dominantColor: sql`excluded.dominant_color`,
};

export function bulkUpsert(db: Db, values: NewAsset[]): number {
  if (values.length === 0) return 0;
  db.transaction((tx) => {
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      tx.insert(assets)
        .values(batch)
        .onConflictDoUpdate({ target: assets.absPath, set: EXCLUDED_SET })
        .run();
    }
  });
  return values.length;
}
