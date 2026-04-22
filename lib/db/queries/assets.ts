import { count, eq } from "drizzle-orm";
import type { Db } from "../client";
import { assets } from "../schema";

export function countAssets(db: Db, sourceId: number): number {
  const [row] = db.select({ c: count() }).from(assets).where(eq(assets.sourceId, sourceId)).all();
  return row?.c ?? 0;
}
