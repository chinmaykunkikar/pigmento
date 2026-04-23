import { subscribe } from "@/lib/plan/dispatch/jobs";
import type { DispatchEvent } from "@/lib/plan/dispatch/types";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const send = (ev: DispatchEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          close();
          return;
        }
        if (ev.type === "done" || ev.type === "error") close();
      };

      const sub = subscribe(jobId, send);
      if (!sub) {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "job not found" })}\n\n`),
        );
        controller.close();
        return;
      }
      unsubscribe = sub.unsubscribe;

      for (const ev of sub.buffered) {
        send(ev);
        if (closed) return;
      }
      if (closed) return;

      if (sub.status !== "running") {
        close();
        return;
      }

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: hb\n\n`));
        } catch {
          close();
        }
      }, 15_000);

      req.signal.addEventListener("abort", close, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
