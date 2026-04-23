import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { assets, sources } from "@/lib/db/schema";
import { validateRename } from "@/lib/rename/validate";

const Params = z.object({ id: z.coerce.number().int().positive() });
const Query = z.object({ target: z.string().min(1).max(512) });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = Params.safeParse(await ctx.params);
  if (!p.success) return fail("bad id", 400);

  const url = new URL(req.url);
  const q = Query.safeParse({ target: url.searchParams.get("target") ?? undefined });
  if (!q.success) return fail("invalid query", 400);

  const db = getDb();
  const [asset] = db.select().from(assets).where(eq(assets.id, p.data.id)).all();
  if (!asset) return fail("asset not found", 404);

  const [source] = db.select().from(sources).where(eq(sources.id, asset.sourceId)).all();
  if (!source) return fail("source not found", 404);

  const result = await validateRename({
    db,
    asset,
    sourceRoot: source.root,
    sourceId: source.id,
    newNameRaw: q.data.target,
  });

  return ok(result);
}
