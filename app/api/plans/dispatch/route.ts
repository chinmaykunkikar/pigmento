import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getDb } from "@/lib/db/client";
import { getSource } from "@/lib/db/queries/sources";
import { writePlanArtifacts } from "@/lib/plan/dispatch/artifacts";
import { listRunningForSource, startJob } from "@/lib/plan/dispatch/jobs";
import { checkHarness } from "@/lib/plan/dispatch/registry";
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

  const db = getDb();
  const source = getSource(db, plan.sourceId);
  if (!source) return fail("source not found", 404);

  if (mode === "dry-run") {
    const artifacts = await writePlanArtifacts(plan, source.root, mode);
    return ok({
      jobId: null,
      dir: artifacts.dir,
      files: artifacts.files,
      hint: `Run: cd ${source.root} && claude --plan ${artifacts.promptPath}`,
    });
  }

  if (listRunningForSource(source.id).length > 0) {
    return fail("a dispatch is already running for this source", 409);
  }

  const { harness: adapter, readiness } = await checkHarness(harness, mode);
  if (!adapter || !readiness.ready) {
    return fail(readiness.ready ? `${harness} is not configured yet` : readiness.reason, 501);
  }

  const artifacts = await writePlanArtifacts(plan, source.root, mode);
  const job = startJob(adapter, {
    plan,
    mode,
    cwd: source.root,
    planDir: artifacts.dir,
  });

  return ok({
    jobId: job.id,
    dir: artifacts.dir,
    files: artifacts.files,
    hint: `streaming /api/plans/dispatch/${job.id}/stream`,
  });
}
