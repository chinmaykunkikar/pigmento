import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { loadConfig } from "@/lib/config/load";
import { getDb } from "@/lib/db/client";
import { addSource, listSourcesWithMeta } from "@/lib/db/queries/sources";
import { runIndexer } from "@/lib/indexer/run";

const AddBody = z.object({
  root: z.string().min(1),
  label: z.string().min(1).optional(),
});

export async function GET() {
  const db = getDb();
  const sources = listSourcesWithMeta(db);
  return ok(sources);
}

export async function POST(req: Request) {
  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body", 400);

  const abs = resolve(parsed.data.root.replace(/^~(?=\/|$)/, process.env.HOME ?? ""));
  const st = await stat(abs).catch(() => null);
  if (!st) return fail(`path does not exist: ${abs}`, 400);
  if (!st.isDirectory()) return fail(`not a directory: ${abs}`, 400);

  const db = getDb();
  const label = parsed.data.label ?? basename(abs);

  let source: ReturnType<typeof addSource>;
  try {
    source = addSource(db, { root: abs, label });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE")) return fail(`already indexed: ${abs}`, 409);
    return fail(msg, 500);
  }

  const config = await loadConfig();
  await runIndexer({ db, source, config, full: false });

  return ok(source);
}
