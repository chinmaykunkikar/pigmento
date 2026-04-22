import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { listExactDuplicates, listNearPairs } from "@/lib/db/queries/duplicates";

const Query = z.object({
  sourceId: z.coerce.number().int().positive(),
  mode: z.enum(["exact", "near"]),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid query", 400);
  const { sourceId, mode } = parsed.data;
  const db = getDb();
  if (mode === "exact") return ok(listExactDuplicates(db, sourceId));
  return ok(listNearPairs(db, sourceId));
}
