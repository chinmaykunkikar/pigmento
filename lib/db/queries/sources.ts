import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { type NewSource, type Source, sources } from "../schema";

export function listSources(db: Db): Source[] {
  return db.select().from(sources).all();
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
