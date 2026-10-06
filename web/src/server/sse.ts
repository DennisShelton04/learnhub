import { pollHub, type RealtimeEvent, realtime } from "@/server/realtime";

const HEARTBEAT_MS = 25_000;

/**
 * A Server-Sent Events response that forwards realtime events for one topic.
 * Sends "ready" once listening so clients can fetch anything they missed.
 * `filter` can drop events this listener shouldn't see (e.g. signals addressed to someone else).
 */
export function sseResponse(request: Request, topic: string, filter?: (event: RealtimeEvent) => boolean) {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = realtime.subscribe(topic, (event) => {
        if (!filter || filter(event)) write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });

      await realtime.ready();
      write("event: ready\ndata: {}\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform stops compression from buffering events.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Serves a live topic either as an SSE stream or, when the client asks with `?poll`, as one
 * long-poll response (`?poll&after=<cursor>`). Clients fall back to polling when a proxy
 * buffers the stream.
 */
export async function realtimeResponse(request: Request, topic: string, filter: (event: RealtimeEvent) => boolean = () => true) {
  const params = new URL(request.url).searchParams;
  if (!params.has("poll")) return sseResponse(request, topic, filter);
  const raw = params.get("after");
  const after = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  const result = await pollHub.poll(topic, after, filter, request.signal);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
