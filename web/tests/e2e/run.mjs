// Runs the browser end-to-end suites. Usage (from web/):
//   npm run test:e2e                      build, start a test server on :3100, run every suite
//   npm run test:e2e -- quizzes battles   run only suites whose file name contains these words
//   E2E_BASE_URL=http://localhost:3000 node tests/e2e/run.mjs   use an already-running server (no build)
// Requires Google Chrome and the local Postgres from the README. Test accounts use the
// e2e.learnhub.test email domain and are deleted (with their data and voice files) at the end.
import { spawn } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, "../..");
nextEnv.loadEnvConfig(webDir);

const EMAIL_DOMAIN = "e2e.learnhub.test";
const filters = process.argv.slice(2);
const suites = readdirSync(here)
  .filter((f) => f.endsWith(".test.mjs"))
  .filter((f) => filters.length === 0 || filters.some((w) => f.includes(w)))
  .sort();
if (suites.length === 0) {
  console.error(`No suites match: ${filters.join(", ")}`);
  process.exit(1);
}

let server = null;
let baseUrl = process.env.E2E_BASE_URL;

async function waitFor(url, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} didn't start in time`);
}

if (!baseUrl) {
  // A separate production server so a running dev server on :3000 is untouched.
  const port = process.env.E2E_PORT ?? "3100";
  baseUrl = `http://localhost:${port}`;
  // Fail fast if something (e.g. another test run) already uses the port; sharing it corrupts both runs.
  const busy = await fetch(baseUrl).then(
    () => true,
    () => false,
  );
  if (busy) {
    console.error(`Port ${port} is already in use (another test run?). Stop it or set E2E_PORT.`);
    process.exit(1);
  }
  server = spawn("npx", ["next", "start", "-p", port], {
    cwd: webDir,
    stdio: ["ignore", "ignore", "inherit"],
    // The proxy suite reaches the server through a second origin.
    env: { ...process.env, BETTER_AUTH_URL: baseUrl, BETTER_AUTH_TRUSTED_ORIGINS: `http://localhost:${process.env.E2E_PROXY_PORT ?? "3101"}` },
  });
  console.log(`Starting test server at ${baseUrl}…`);
  await waitFor(baseUrl);
}

function runSuite(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(here, file)], {
      cwd: webDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, E2E_BASE_URL: baseUrl },
    });
    let output = "";
    const tee = (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    };
    child.stdout.on("data", tee);
    child.stderr.on("data", tee);
    child.on("exit", (code) => {
      const tally = output.match(/(\d+)\/(\d+) passed/);
      resolve({ file, ok: code === 0, tally: tally ? `${tally[1]}/${tally[2]}` : "crashed", seconds: Math.round((Date.now() - started) / 1000) });
    });
  });
}

/** Deletes test accounts (their communities, posts, messages… cascade) and voice files no message uses. */
async function cleanup() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rowCount } = await pool.query(`delete from "user" where email like $1`, [`%@${EMAIL_DOMAIN}`]);
    const { rows } = await pool.query(`select audio_key from message where audio_key is not null`);
    const keep = new Set(rows.map((r) => r.audio_key));
    const voiceDir = path.join(webDir, process.env.STORAGE_LOCAL_DIR ?? "uploads", "voice");
    let removed = 0;
    for (const f of readdirSafe(voiceDir)) {
      if (!keep.has(`voice/${f}`)) {
        rmSync(path.join(voiceDir, f), { force: true });
        removed++;
      }
    }
    console.log(`Cleanup: removed ${rowCount} test account(s) and ${removed} unused voice file(s).`);
  } finally {
    await pool.end();
  }
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

const results = [];
try {
  for (const file of suites) {
    console.log(`\n━━━ ${file} ━━━`);
    results.push(await runSuite(file));
  }
} finally {
  server?.kill("SIGTERM");
  await cleanup().catch((err) => console.error("Cleanup failed:", err.message));
}

console.log("\n━━━ Summary ━━━");
for (const r of results) console.log(`${r.ok ? "✅" : "❌"}  ${r.file.padEnd(32)} ${r.tally.padStart(7)}   ${r.seconds}s`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} suite(s) failed.` : "\nAll suites passed.");
process.exit(failed ? 1 : 0);
