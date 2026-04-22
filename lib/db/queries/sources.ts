import { and, eq, like, or, sql } from "drizzle-orm";
import type { Db } from "../client";
import { assets, type NewSource, type Source, sources } from "../schema";

export type SourceWithMeta = Source & {
  hasTshirtVariants: boolean;
  hasPixelVariants: boolean;
};

export function listSources(db: Db): Source[] {
  return db.select().from(sources).all();
}

export function listSourcesWithMeta(db: Db): SourceWithMeta[] {
  const rows = db.select().from(sources).all();
  return rows.map((s) => ({
    ...s,
    hasTshirtVariants: detectTshirt(db, s.id),
    hasPixelVariants: detectPixel(db, s.id),
  }));
}

export function getSource(db: Db, id: number): Source | undefined {
  const [row] = db.select().from(sources).where(eq(sources.id, id)).all();
  return row;
}

export function addSource(db: Db, input: NewSource): Source {
  const [row] = db.insert(sources).values(input).returning().all();
  if (!row) throw new Error("failed to insert source");
  return row;
}

function detectTshirt(db: Db, sourceId: number): boolean {
  const [row] = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(assets)
    .where(
      and(
        eq(assets.sourceId, sourceId),
        or(
          like(assets.stem, "%-sm"),
          like(assets.stem, "%-md"),
          like(assets.stem, "%-lg"),
          like(assets.stem, "%-xl"),
          like(assets.stem, "%-xxl"),
          like(assets.stem, "%-small"),
          like(assets.stem, "%-medium"),
          like(assets.stem, "%-large"),
          like(assets.dir, "%small%"),
          like(assets.dir, "%medium%"),
          like(assets.dir, "%large%"),
        ),
      ),
    )
    .all();
  return (row?.n ?? 0) > 0;
}

function detectPixel(db: Db, sourceId: number): boolean {
  const [row] = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(assets)
    .where(
      and(
        eq(assets.sourceId, sourceId),
        or(
          like(assets.stem, "%-16"),
          like(assets.stem, "%-20"),
          like(assets.stem, "%-24"),
          like(assets.stem, "%-32"),
          like(assets.stem, "%-48"),
          like(assets.stem, "%-64"),
          like(assets.dir, "%/16%"),
          like(assets.dir, "%/24%"),
          like(assets.dir, "%/32%"),
          like(assets.dir, "%/48%"),
          like(assets.dir, "%/64%"),
        ),
      ),
    )
    .all();
  return (row?.n ?? 0) > 0;
}
