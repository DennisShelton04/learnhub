// Shared helpers for the browser end-to-end suites. Run them with `npm run test:e2e` (see run.mjs).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));

export const B = process.env.E2E_BASE_URL ?? "http://localhost:3000";
/** Unique per run, so names and emails never collide with earlier runs. */
export const T = Date.now();
/** Every test account uses this domain; run.mjs deletes them afterwards. Never use it for real accounts. */
export const EMAIL_DOMAIN = "e2e.learnhub.test";
export const UPLOADS_DIR = path.resolve(here, "../../", process.env.STORAGE_LOCAL_DIR ?? "uploads", "voice");

const outputDir = path.join(here, "output");
/** Path for a screenshot or other artefact (git-ignored). */
export function out(file) {
  mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, file);
}

const results = [];
export function check(name, ok, extra = "") {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`);
}
export function summary() {
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) process.exitCode = 1;
}

// Real Chrome (headless) with a fake microphone so voice notes and WebRTC can be tested.
export const browser = await chromium.launch({
  channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
  headless: process.env.E2E_HEADED !== "1",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});

/** A fresh, logged-out browser tab (confirm() dialogs are auto-accepted). */
export async function newPage(opts = {}) {
  const ctx = await browser.newContext({ permissions: ["microphone"], ...opts });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  return page;
}

export const emailFor = (name) => `${name.toLowerCase().replace(/\s/g, "")}${T}@${EMAIL_DOMAIN}`;

/**
 * Submits the login/sign-up form. Better Auth rate-limits sign-ups per IP and the suites create
 * many accounts quickly, so wait and retry when limited.
 */
export async function submitAuth(page, urlGlob) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.click("button[type=submit]");
    const done = await page.waitForURL(urlGlob, { timeout: 5000 }).then(
      () => true,
      () => false,
    );
    if (done) return;
    const alert = await page.locator("form p[role=alert]").textContent().catch(() => "");
    if (!alert?.includes("Too many")) throw new Error(`auth failed: ${alert}`);
    await page.waitForTimeout(10000);
  }
  throw new Error("still rate limited");
}

/** Signs up a new user in a fresh tab and returns the tab, on the dashboard. */
export async function newUser(name, opts = {}) {
  const page = await newPage(opts);
  await page.goto(`${B}/signup`);
  await page.fill("input[name=name]", name);
  await page.fill("input[name=email]", emailFor(name));
  await page.fill("input[name=password]", "secret123");
  await submitAuth(page, "**/dashboard");
  return page;
}

export async function createCommunity(page, name, visibility = "public") {
  await page.goto(`${B}/communities/new`);
  await page.fill("input[name=name]", name);
  await page.check(`input[value=${visibility}]`);
  await page.click("button[type=submit]");
  await page.waitForURL("**/c/**");
  await page.getByRole("heading", { name: `Welcome to ${name}` }).waitFor();
  return page.url();
}

export async function shareNote(page, cUrl, title, body = "Let's discuss.") {
  await page.goto(`${cUrl}/new?type=note`);
  await page.fill("input[name=title]", title);
  await page.fill("textarea[name=body]", body);
  await page.click("button[type=submit]");
  await page.waitForURL("**/p/**");
  return page.url();
}

export async function join(page, cUrl) {
  await page.goto(cUrl);
  await page.getByRole("button", { name: "Join community" }).first().click();
  await page.getByRole("link", { name: "Share something" }).first().waitFor();
}

/** Waits for the live-updates indicator to turn green. */
export const live = (page) => page.getByText("Live", { exact: true }).waitFor({ timeout: 10000 });
