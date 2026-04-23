import { fail, ok } from "@/lib/api/response";
import { cancelJob, getJob } from "@/lib/plan/dispatch/jobs";

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job) return fail("job not found", 404);
  return ok(job);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const existed = cancelJob(jobId);
  if (!existed) return fail("job not found", 404);
  return ok({ cancelled: true });
}
