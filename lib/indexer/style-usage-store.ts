import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { type NewStyleUsage, styleUsages } from "../db/schema";

const BATCH = 500;

// Wholesale per (source, kind) rebuild — deleting only this kind's rows so the
// color stage never touches typography (or vice versa) in the same source.
export function rebuildStyleUsages(
  db: Db,
  sourceId: number,
  kind: string,
  rows: NewStyleUsage[],
): number {
  db.transaction((tx) => {
    tx.delete(styleUsages)
      .where(and(eq(styleUsages.sourceId, sourceId), eq(styleUsages.kind, kind)))
      .run();
    for (let i = 0; i < rows.length; i += BATCH) {
      tx.insert(styleUsages)
        .values(rows.slice(i, i + BATCH))
        .run();
    }
  });
  return rows.length;
}
