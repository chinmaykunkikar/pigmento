import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { usages } from "../db/schema";
import type { UsageHit } from "./usage";

const BATCH = 500;

export function rebuildUsages(db: Db, sourceId: number, hits: UsageHit[]): number {
  db.delete(usages).where(eq(usages.sourceId, sourceId)).run();
  if (hits.length === 0) return 0;
  db.transaction((tx) => {
    for (let i = 0; i < hits.length; i += BATCH) {
      const batch = hits.slice(i, i + BATCH);
      tx.insert(usages).values(batch).run();
    }
  });
  return hits.length;
}
