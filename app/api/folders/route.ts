import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { type SizeBucket, searchAssets } from "@/lib/db/queries/folders";

const ALLOWED_EXTS = ["svg", "png", "jpg", "jpeg", "webp", "gif"] as const;

const Query = z.object({
  sourceId: z.coerce.number().int().positive(),
  path: z.string().optional(),
  q: z.string().optional(),
  exts: z.string().optional(),
  size: z.enum(["s", "m", "l"]).optional(),
  unusedOnly: z.enum(["1", "0", "true", "false"]).optional(),
});

export function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    sourceId: url.searchParams.get("sourceId"),
    path: url.searchParams.get("path") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    exts: url.searchParams.get("exts") ?? undefined,
    size: url.searchParams.get("size") ?? undefined,
    unusedOnly: url.searchParams.get("unusedOnly") ?? undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "bad query", 400);

  const exts = parsed.data.exts
    ?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is (typeof ALLOWED_EXTS)[number] =>
      (ALLOWED_EXTS as readonly string[]).includes(s),
    );
  const unusedOnly = parsed.data.unusedOnly === "1" || parsed.data.unusedOnly === "true";

  const db = getDb();
  const assets = searchAssets(db, {
    sourceId: parsed.data.sourceId,
    path: parsed.data.path,
    q: parsed.data.q,
    exts: exts && exts.length > 0 ? exts : undefined,
    size: parsed.data.size as SizeBucket | undefined,
    unusedOnly,
  });
  return ok(assets, { total: assets.length });
}
