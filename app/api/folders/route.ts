import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { listByFolder, listBySource } from "@/lib/db/queries/folders";

const Query = z.object({
  sourceId: z.coerce.number().int().positive(),
  path: z.string().optional(),
});

export function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    sourceId: url.searchParams.get("sourceId"),
    path: url.searchParams.get("path") ?? undefined,
  });
  if (!parsed.success) return fail("sourceId required", 400);

  const db = getDb();
  const assets =
    parsed.data.path === undefined
      ? listBySource(db, parsed.data.sourceId)
      : listByFolder(db, parsed.data.sourceId, parsed.data.path);
  return ok(assets, { total: assets.length });
}
