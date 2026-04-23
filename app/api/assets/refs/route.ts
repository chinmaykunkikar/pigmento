import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { getAssetRefs } from "@/lib/db/queries/assets";

const Query = z.object({
  ids: z
    .string()
    .min(1)
    .transform((s, ctx) => {
      const parts = s.split(",");
      const out: number[] = [];
      for (const p of parts) {
        const n = Number(p);
        if (!Number.isInteger(n) || n <= 0) {
          ctx.addIssue({ code: "custom", message: `invalid id: ${p}` });
          return z.NEVER;
        }
        out.push(n);
      }
      if (out.length === 0 || out.length > 500) {
        ctx.addIssue({ code: "custom", message: "1–500 ids required" });
        return z.NEVER;
      }
      return out;
    }),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid query", 400);
  const db = getDb();
  return ok(getAssetRefs(db, parsed.data.ids));
}
