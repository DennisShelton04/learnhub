"use client";

/**
 * Subscribes to a live topic (one of the /api/.../events routes).
 *
 * Uses Server-Sent Events when they get through. Some proxies (e.g. Cloudflare quick tunnels used by
 * `npm run share`) hold SSE responses back, so if the stream doesn't say "ready" in time we switch to
 * long polling the same URL, which works through anything that passes normal requests.
 *
 * `onEvent("ready")` fires on every (re)connect: refetch state then to catch anything missed.
 */

export type LiveStatus = "connecting" | "live" | "reconnecting";
type Handlers = {
  types: string[];
  onEvent: (type: string, payload: unknown) => void;
  onStatus?: (status: LiveStatus) => void;
};

const SSE_READY_TIMEOUT_MS = 4000;
const RETRY_DELAY_MS = 2000;

// Once SSE has failed in this tab, go straight to polling for other subscriptions.
let preferPolling = false;

export function subscribeLive(url: string, { types, onEvent, onStatus }: Handlers) {
  let closed = false;
  let stopCurrent = () => {};

  const startPolling = () => {
    const controller = new AbortController();
    stopCurrent = () => controller.abort();
    void (async () => {
      let cursor: number | null = null;
      while (!closed) {
        try {
          const query: string = `poll${cursor === null ? "" : `&after=${cursor}`}`;
          const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}${query}`, { cache: "no-store", signal: controller.signal });
          if (!res.ok) throw new Error(`poll failed: ${res.status}`);
          const data = (await res.json()) as { cursor: number; events: { type: string }[]; reset: boolean };
          if (cursor === null || data.reset) {
            onStatus?.("live");
            onEvent("ready", {});
          }
          cursor = data.cursor;
          for (const event of data.events) onEvent(event.type, event);
        } catch {
          if (closed) return;
          onStatus?.("reconnecting");
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    })();
  };

  const startSse = () => {
    const source = new EventSource(url);
    let ready = false;
    const fallback = setTimeout(() => {
      if (ready || closed) return;
      source.close();
      preferPolling = true;
      startPolling();
    }, SSE_READY_TIMEOUT_MS);
    stopCurrent = () => {
      clearTimeout(fallback);
      source.close();
    };

    source.addEventListener("ready", () => {
      ready = true;
      clearTimeout(fallback);
      onStatus?.("live");
      onEvent("ready", {});
    });
    for (const type of types) {
      source.addEventListener(type, (e) => onEvent(type, JSON.parse((e as MessageEvent).data)));
    }
    // EventSource reconnects by itself once it has worked.
    source.onerror = () => {
      if (ready) onStatus?.("reconnecting");
    };
  };

  onStatus?.("connecting");
  if (preferPolling || typeof EventSource === "undefined") startPolling();
  else startSse();

  return () => {
    closed = true;
    stopCurrent();
  };
}
