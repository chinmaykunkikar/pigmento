import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { type GroupSort, listNameGroups } from "@/lib/db/queries/groups";

const Query = z.object({
  sourceId: z.coerce.number().int().positive(),
  kind: z.enum(["name"]).default("name"),
  sort: z.enum(["size", "alpha"]).default("size"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  folder: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid query", 400);
  const { sourceId, sort, limit, offset, folder } = parsed.data;
  const db = getDb();
  const page = listNameGroups(
    db,
    sourceId,
    sort as GroupSort,
    limit,
    offset,
    folder && folder.length > 0 ? folder : undefined,
  );
  return ok(page);
}
