// A tiny HTTP proxy that behaves like a Cloudflare quick tunnel (and some corporate proxies):
// normal responses pass straight through, but Server-Sent Event streams are held back until they end.
import http from "node:http";

export function startBufferingProxy(target, port) {
  const upstream = new URL(target);
  const server = http.createServer((req, res) => {
    // Keep the original Host header so the app sees the proxy's address (like a real tunnel).
    const up = http.request(
      { host: upstream.hostname, port: upstream.port, method: req.method, path: req.url, headers: req.headers },
      (upRes) => {
        const isStream = (upRes.headers["content-type"] ?? "").includes("text/event-stream");
        if (!isStream) {
          res.writeHead(upRes.statusCode ?? 502, upRes.headers);
          upRes.pipe(res);
          return;
        }
        const chunks = [];
        upRes.on("data", (c) => chunks.push(c));
        upRes.on("end", () => {
          res.writeHead(upRes.statusCode ?? 502, upRes.headers);
          res.end(Buffer.concat(chunks));
        });
        res.on("close", () => upRes.destroy());
      },
    );
    up.on("error", () => res.destroy());
    req.pipe(up);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
