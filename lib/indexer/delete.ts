import { and, eq, notInArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { assets } from "../db/schema";

export function deleteMissing(db: Db, sourceId: number, keepAbsPaths: string[]): number {
  if (keepAbsPaths.length === 0) {
    const res = db.delete(assets).where(eq(assets.sourceId, sourceId)).run();
    return res.changes;
  }
  const res = db
    .delete(assets)
    .where(and(eq(assets.sourceId, sourceId), notInArray(assets.absPath, keepAbsPaths)))
    .run();
  return res.changes;
}
