// Shares this machine's LearnHub with others through a Cloudflare quick tunnel (https://*.trycloudflare.com).
// Usage: npm run share   (builds first). Stop with Ctrl+C.
import { spawn, spawnSync } from "node:child_process";

const PORT = process.env.PORT ?? "3000";
const children = [];

function stopAll(code = 0) {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

if (spawnSync("cloudflared", ["--version"]).error) {
  console.error("cloudflared is not installed. Install it with: brew install cloudflared");
  process.exit(1);
}

// 1. Open the tunnel and wait for its public URL.
const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`]);
children.push(tunnel);
tunnel.on("exit", (code) => {
  console.error(`\nThe tunnel stopped (exit code ${code}).`);
  stopAll(1);
});

const url = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out waiting for the tunnel URL.")), 60_000);
  const onData = (chunk) => {
    const match = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      clearTimeout(timer);
      resolve(match[0]);
    }
  };
  tunnel.stdout.on("data", onData);
  tunnel.stderr.on("data", onData);
}).catch((err) => {
  console.error(err.message);
  stopAll(1);
});

// 2. Start the production server, trusting the tunnel URL for logins.
const server = spawn("npx", ["next", "start", "-p", PORT], {
  stdio: "inherit",
  env: {
    ...process.env,
    BETTER_AUTH_URL: url,
    BETTER_AUTH_TRUSTED_ORIGINS: `${url},http://localhost:${PORT}`,
  },
});
children.push(server);
server.on("exit", (code) => stopAll(code ?? 1));

// 3. Keep the Mac awake while sharing (macOS only).
if (process.platform === "darwin") children.push(spawn("caffeinate", ["-is"]));

console.log(`
  ┌───────────────────────────────────────────────────────────┐
    LearnHub is shared at:

    ${url}

    Send this link to your testers (open it yourself too).
    Keep this window open and your Mac awake. Ctrl+C to stop.
  └───────────────────────────────────────────────────────────┘
`);
