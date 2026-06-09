import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { assets } from "../db/schema";
import { popcountHex } from "./phash";

export function backfillPhashPopcount(db: Db, sourceId: number): number {
  const rows = db
    .select({ id: assets.id, phash: assets.phash })
    .from(assets)
    .where(
      and(eq(assets.sourceId, sourceId), isNotNull(assets.phash), isNull(assets.phashPopcount)),
    )
    .all();
  if (rows.length === 0) return 0;
  db.transaction((tx) => {
    for (const row of rows) {
      if (!row.phash) continue;
      tx.update(assets)
        .set({ phashPopcount: popcountHex(row.phash) })
        .where(eq(assets.id, row.id))
        .run();
    }
  });
  return rows.length;
}
