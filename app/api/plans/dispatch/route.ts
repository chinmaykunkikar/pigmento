import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { getSource } from "@/lib/db/queries/sources";
import { serializePlan } from "@/lib/plan/export";
import { generatePrompt } from "@/lib/plan/prompt";
import { planSchema } from "@/lib/plan/schema";

const Body = z.object({
  plan: planSchema,
  mode: z.enum(["dry-run", "patch", "open-pr"]),
  harness: z.enum(["claude-code", "devin", "codex-cli"]).default("claude-code"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "invalid body", 400);
  }
  const { plan, mode, harness } = parsed.data;

  if (mode !== "dry-run") {
    return fail(`mode ${mode} is not implemented yet`, 501);
  }
  if (harness !== "claude-code") {
    return fail(`harness ${harness} is not configured`, 501);
  }

  const db = getDb();
  const source = getSource(db, plan.sourceId);
  if (!source) return fail("source not found", 404);

  const dir = join(source.root, ".pixeldex", plan.id);
  await mkdir(dir, { recursive: true });

  const jsonPath = join(dir, "plan.json");
  const promptPath = join(dir, "plan.md");
  await writeFile(jsonPath, serializePlan(plan, "json"), "utf8");
  await writeFile(promptPath, generatePrompt(plan), "utf8");

  return ok({
    dir,
    files: [jsonPath, promptPath],
    hint: `Run: cd ${source.root} && claude --plan ${join(".pixeldex", plan.id, "plan.md")}`,
  });
}
