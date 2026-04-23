import { fail, ok } from "@/lib/api/response";
import { getConfig } from "@/lib/config/load";
import { getDb } from "@/lib/db/client";
import { findMatches, type MatchBuckets } from "@/lib/db/queries/matches";
import { getSource } from "@/lib/db/queries/sources";
import { embedImage } from "@/lib/match/clip";
import { isAllowedExt, normalizeExt, type QuerySignature } from "@/lib/match/ext";
import { computeSignature } from "@/lib/match/signature";

const MAX_BYTES = 2 * 1024 * 1024;

export type MatchResponse = {
  signature: QuerySignature;
  buckets: MatchBuckets;
  clipEnabled: boolean;
};

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return fail("expected multipart/form-data", 400);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("invalid form data", 400);
  }

  const sourceIdRaw = form.get("sourceId");
  const file = form.get("file");
  if (typeof sourceIdRaw !== "string" || !(file instanceof File)) {
    return fail("missing sourceId or file", 400);
  }
  const sourceId = Number(sourceIdRaw);
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    return fail("invalid sourceId", 400);
  }
  if (file.size === 0) return fail("file is empty", 400);
  if (file.size > MAX_BYTES) return fail(`file exceeds ${MAX_BYTES / 1024 / 1024} MB`, 413);
  if (!isAllowedExt(file.name)) {
    return fail("unsupported file type (svg, png, jpg, webp, gif only)", 415);
  }

  const db = getDb();
  const source = getSource(db, sourceId);
  if (!source) return fail("source not found", 404);

  const config = await getConfig();
  const clipEnabled = config.clip.enabled;

  const buf = Buffer.from(await file.arrayBuffer());
  const [signature, embedding] = await Promise.all([
    computeSignature(buf, file.name),
    clipEnabled ? embedImage(buf, normalizeExt(file.name)) : Promise.resolve(null),
  ]);
  const buckets = findMatches(db, sourceId, signature, embedding);

  return ok<MatchResponse>({ signature, buckets, clipEnabled });
}
