import { indexerEvents, type StageEvent } from "../../../lib/indexer/events";

export function GET(req: Request) {
  const emitter = indexerEvents();
  const encoder = new TextEncoder();

  let handler: ((ev: StageEvent) => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`: ready\n\n`));
      handler = (ev) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          /* closed */
        }
      };
      emitter.on("event", handler);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: hb\n\n`));
        } catch {
          /* closed */
        }
      }, 15_000);
    },
    cancel() {
      if (handler) emitter.off("event", handler);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  req.signal.addEventListener("abort", () => {
    if (handler) emitter.off("event", handler);
    if (heartbeat) clearInterval(heartbeat);
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
