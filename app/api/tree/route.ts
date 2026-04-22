import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { buildTree, folderDistribution } from "@/lib/db/queries/folders";

const Query = z.object({ sourceId: z.coerce.number().int().positive() });

export function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({ sourceId: url.searchParams.get("sourceId") });
  if (!parsed.success) return fail("sourceId required", 400);
  const db = getDb();
  const rows = folderDistribution(db, parsed.data.sourceId);
  return ok(buildTree(rows));
}
