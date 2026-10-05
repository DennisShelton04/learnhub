import { UPLOADS_DIR, out } from "./helpers.mjs";
import { readdirSync } from "node:fs";
import { B, T, browser, check, createCommunity, join, live, newUser, shareNote, summary } from "./helpers.mjs";
const UPLOADS = UPLOADS_DIR;
const players = (page) => page.getByRole("button", { name: /Play voice note|Pause voice note/ });

const olivia = await newUser("Olivia");
const cUrl = await createCommunity(olivia, `Voice ${T}`);
const postUrl = await shareNote(olivia, cUrl, "Pronunciation practice");
const max = await newUser("Max");
await join(max, cUrl);
await max.goto(postUrl); await live(max);
await olivia.goto(postUrl); await live(olivia);

// Record and send
await olivia.getByRole("button", { name: "Record voice note" }).click();
await olivia.getByText(/Recording 0:0\d/).waitFor();
check("recording UI shows a timer", true);
await olivia.waitForTimeout(2600);
await olivia.getByRole("button", { name: "Send voice note" }).click();
await players(olivia).first().waitFor({ timeout: 10000 });
check("voice note appears for sender", (await players(olivia).count()) === 1);
const arrived = await players(max).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
check("voice note arrives live for other member", arrived);
const label = await max.locator("li", { has: players(max) }).locator("span.tabular-nums").innerText();
check("duration shown (~0:02-0:03)", /^0:0[23]$/.test(label), label);

// Playback
await players(max).first().click();
await max.waitForTimeout(1200);
const playback = await max.locator("audio").first().evaluate((a) => ({ paused: a.paused, t: a.currentTime, err: a.error?.code ?? null }));
check("voice note plays back", !playback.paused && playback.t > 0.3 && playback.err === null, JSON.stringify(playback));

// Audio endpoint security + range
const audioUrl = await max.locator("audio").first().getAttribute("src");
const anon = await (await browser.newContext()).request.get(B + audioUrl);
check("audio requires login", anon.status() === 401);
const ranged = await max.request.get(B + audioUrl, { headers: { Range: "bytes=0-99" } });
check("range requests return 206 partial content", ranged.status() === 206 && (await ranged.body()).length === 100 && ranged.headers()["content-range"]?.startsWith("bytes 0-99/"));
check("audio served with safe headers", ranged.headers()["x-content-type-options"] === "nosniff" && ranged.headers()["content-type"].startsWith("audio/"));

// Too short + discard
await olivia.getByRole("button", { name: "Record voice note" }).click();
await olivia.getByText(/Recording/).waitFor();
await olivia.getByRole("button", { name: "Send voice note" }).click();
check("too-short recording rejected", await olivia.getByRole("alert").filter({ hasText: "too short" }).waitFor({ timeout: 5000 }).then(() => true, () => false));
await olivia.getByRole("button", { name: "Record voice note" }).click();
await olivia.waitForTimeout(1500);
await olivia.getByRole("button", { name: "Discard recording" }).click();
await olivia.getByRole("textbox", { name: "Message" }).waitFor();
await olivia.waitForTimeout(800);
check("discarded recording isn't sent", (await players(olivia).count()) === 1);

// Voice reply to a text message shows reference
await max.getByRole("textbox", { name: "Message" }).fill("How do you say 'closure'?");
await max.getByRole("textbox", { name: "Message" }).press("Enter");
const textRow = olivia.locator("li", { hasText: "How do you say" }).last();
await textRow.waitFor();
await textRow.hover();
await textRow.getByRole("button", { name: "Reply", exact: true }).click();
await olivia.getByRole("button", { name: "Record voice note" }).click();
await olivia.waitForTimeout(1800);
await olivia.getByRole("button", { name: "Send voice note" }).click();
await players(max).nth(1).waitFor({ timeout: 8000 });
const replyRow = max.locator("li").filter({ has: players(max) }).nth(1);
check("voice reply shows reference to original", (await replyRow.getByText("@Max").count()) === 1);

// Upload validation through the API (as member Max)
const post = (multipart) => max.request.post(`${B}/api/posts/${postUrl.split("/p/")[1]}/voice`, { multipart });
const fake = await post({ audio: { name: "x.webm", mimeType: "audio/webm", buffer: Buffer.from("<html>not audio</html>".padEnd(64, " ")) }, durationMs: "2000" });
check("non-audio file rejected (415)", fake.status() === 415, String(fake.status()));
const big = await post({ audio: { name: "x.webm", mimeType: "audio/webm", buffer: Buffer.alloc(6 * 1024 * 1024, 1) }, durationMs: "2000" });
check("oversized upload rejected (413)", big.status() === 413, String(big.status()));
const longDur = await post({ audio: { name: "x.webm", mimeType: "audio/webm", buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...Array(60).fill(0)]) }, durationMs: String(10 * 60 * 1000) });
check("over-5-minute duration rejected (400)", longDur.status() === 400, String(longDur.status()));
const outsider = await newUser("Outsider");
const outRes = await outsider.request.post(`${B}/api/posts/${postUrl.split("/p/")[1]}/voice`, { multipart: { audio: { name: "x.webm", mimeType: "audio/webm", buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...Array(60).fill(0)]) }, durationMs: "2000" } });
check("non-member can't upload (403)", outRes.status() === 403, String(outRes.status()));

// Delete removes the file
const before = readdirSync(UPLOADS).length;
const firstRow = olivia.locator("li", { has: players(olivia).first() }).first();
await firstRow.hover();
await firstRow.getByRole("button", { name: "Delete message" }).click();
await olivia.waitForTimeout(1000);
const after = readdirSync(UPLOADS).length;
check("deleting a voice note removes the file", after === before - 1, `${before} -> ${after}`);
const gone = await max.request.get(B + audioUrl);
check("deleted voice note's audio is gone (404)", gone.status() === 404);

await olivia.setViewportSize({ width: 1100, height: 800 });
await olivia.screenshot({ path: out("voice.png") });
await browser.close();
summary();
