import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { findAssetDetail } from "@/lib/db/queries/asset-detail";

const Params = z.object({ id: z.coerce.number().int().positive() });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = Params.safeParse(await ctx.params);
  if (!parsed.success) return fail("bad id", 400);
  const db = getDb();
  const detail = findAssetDetail(db, parsed.data.id);
  if (!detail) return fail("not found", 404);
  return ok(detail);
}
