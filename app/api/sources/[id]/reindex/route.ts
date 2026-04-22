import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { loadConfig } from "@/lib/config/load";
import { getDb } from "@/lib/db/client";
import { getSource } from "@/lib/db/queries/sources";
import { runIndexer } from "@/lib/indexer/run";

const Params = z.object({ id: z.coerce.number().int().positive() });

const Body = z.object({ full: z.boolean().optional() }).default({});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsedParams = Params.safeParse(await ctx.params);
  if (!parsedParams.success) return fail("bad id", 400);

  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return fail("invalid body", 400);

  const db = getDb();
  const source = getSource(db, parsedParams.data.id);
  if (!source) return fail("source not found", 404);

  const config = await loadConfig();
  await runIndexer({ db, source, config, full: body.data.full ?? false });
  return ok(source);
}
