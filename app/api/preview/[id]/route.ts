import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { z } from "zod";
import { fail } from "../../../../lib/api/response";
import { getDb } from "../../../../lib/db/client";
import { findAssetById } from "../../../../lib/db/queries/folders";

const MIME: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const Params = z.object({ id: z.coerce.number().int().positive() });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = Params.safeParse(await ctx.params);
  if (!parsed.success) return fail("bad id", 400);

  const db = getDb();
  const asset = findAssetById(db, parsed.data.id);
  if (!asset) return fail("not found", 404);

  const st = await stat(asset.absPath).catch(() => null);
  if (!st) return fail("file missing on disk", 410);

  const contentType = MIME[asset.ext] ?? "application/octet-stream";
  const stream = Readable.toWeb(createReadStream(asset.absPath)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(st.size),
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
