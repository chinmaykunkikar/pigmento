import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { usages } from "../db/schema";
import type { UsageHit } from "./usage";

const BATCH = 500;

export function rebuildUsages(db: Db, sourceId: number, hits: UsageHit[]): number {
  db.transaction((tx) => {
    tx.delete(usages).where(eq(usages.sourceId, sourceId)).run();
    for (let i = 0; i < hits.length; i += BATCH) {
      const batch = hits.slice(i, i + BATCH);
      tx.insert(usages).values(batch).run();
    }
  });
  return hits.length;
}
