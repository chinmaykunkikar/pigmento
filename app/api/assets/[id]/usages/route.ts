import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { listAssetUsages } from "@/lib/db/queries/asset-detail";

const Params = z.object({ id: z.coerce.number().int().positive() });
const Query = z.object({
  cursor: z.coerce.number().int().positive().nullable().default(null),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = Params.safeParse(await ctx.params);
  if (!p.success) return fail("bad id", 400);

  const url = new URL(req.url);
  const q = Query.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!q.success) return fail("invalid query", 400);

  const db = getDb();
  const rows = listAssetUsages(db, p.data.id, q.data.cursor, q.data.limit);
  return ok(rows, { total: rows.length, limit: q.data.limit });
}
