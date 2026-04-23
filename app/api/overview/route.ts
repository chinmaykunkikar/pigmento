import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { getOverviewCounts } from "@/lib/db/queries/overview";

const Query = z.object({
  sourceId: z.coerce.number().int().positive(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid query", 400);
  const db = getDb();
  return ok(getOverviewCounts(db, parsed.data.sourceId));
}
