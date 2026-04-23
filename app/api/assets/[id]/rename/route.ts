import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { loadConfig } from "@/lib/config/load";
import { getDb } from "@/lib/db/client";
import { assets, sources } from "@/lib/db/schema";
import { reindexAfterRename } from "@/lib/indexer/reindex";
import { executeRename, RenameError } from "@/lib/rename/execute";

const Params = z.object({ id: z.coerce.number().int().positive() });
const Body = z.object({
  newName: z.string().min(1).max(512),
  acceptedUsageIds: z
    .union([z.literal("all"), z.array(z.number().int().positive())])
    .default("all"),
  skipStale: z.boolean().default(false),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = Params.safeParse(await ctx.params);
  if (!p.success) return fail("bad id", 400);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return fail("invalid json", 400);
  }
  const b = Body.safeParse(payload);
  if (!b.success) return fail("invalid body", 400);

  const db = getDb();
  const [asset] = db.select().from(assets).where(eq(assets.id, p.data.id)).all();
  if (!asset) return fail("asset not found", 404);

  const [source] = db.select().from(sources).where(eq(sources.id, asset.sourceId)).all();
  if (!source) return fail("source not found", 404);

  try {
    const result = await executeRename({
      db,
      asset,
      sourceRoot: source.root,
      sourceId: source.id,
      newNameRaw: b.data.newName,
      acceptedUsageIds: b.data.acceptedUsageIds,
      skipStale: b.data.skipStale,
    });

    let reindexWarning: string | undefined;
    try {
      const config = await loadConfig();
      await reindexAfterRename(db, source, config, result.newAbsPath, result.assetId);
    } catch (err) {
      reindexWarning = err instanceof Error ? err.message : String(err);
    }

    return ok({
      assetId: result.assetId,
      newRelPath: result.newRelPath,
      newName: result.newName,
      updatedUsageCount: result.updatedUsageCount,
      commitSha: result.commitSha,
      staleRefs: result.staleRefs,
      reindexWarning,
    });
  } catch (err) {
    if (err instanceof RenameError) {
      const status =
        err.code === "PRECONDITION_FAILED" || err.code === "DIRTY_WORKING_TREE" ? 409 : 500;
      return fail(`${err.code}: ${err.message}`, status);
    }
    return fail(err instanceof Error ? err.message : "rename failed", 500);
  }
}
