// Live features must keep working behind proxies that buffer Server-Sent Events
// (e.g. Cloudflare quick tunnels used by `npm run share`).
import { startBufferingProxy } from "./buffering-proxy.mjs";

const target = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const port = Number(process.env.E2E_PROXY_PORT ?? 3101);
const proxy = await startBufferingProxy(target, port);
process.env.E2E_BASE_URL = `http://localhost:${port}`;
const { T, browser, check, createCommunity, join, newUser, shareNote, summary } = await import("./helpers.mjs");

const liveDot = (page) => page.getByText("Live", { exact: true }).waitFor({ timeout: 15000 }).then(() => true, () => false);

const olivia = await newUser("Olivia");
const cUrl = await createCommunity(olivia, `Proxy ${T}`);
const postUrl = await shareNote(olivia, cUrl, "Through the tunnel");
const max = await newUser("Max");
await join(max, cUrl);

await Promise.all([olivia.goto(postUrl), max.goto(postUrl)]);
check("chat shows Live behind a buffering proxy", (await liveDot(olivia)) && (await liveDot(max)));

const box = olivia.getByRole("textbox", { name: "Message", exact: true });
await box.fill("Hello through the proxy");
await box.press("Enter");
const arrived = await max
  .locator("p.whitespace-pre-wrap", { hasText: "Hello through the proxy" })
  .waitFor({ timeout: 10000 })
  .then(() => true, () => false);
check("message arrives live for the other user", arrived);

const bell = await olivia
  .getByRole("link", { name: "Notifications, 0 unread", exact: true })
  .count()
  .then(() => true);
await max.getByRole("textbox", { name: "Message", exact: true }).fill("Reply from Max");
await max.getByRole("textbox", { name: "Message", exact: true }).press("Enter");
const notified = await olivia
  .getByRole("link", { name: "Notifications, 1 unread", exact: true })
  .waitFor({ timeout: 10000 })
  .then(() => true, () => false);
check("notification bell updates live", bell && notified);

// Study room voice needs live signalling between the two browsers.
const roomUrl = `${postUrl}/room`;
await Promise.all([olivia.goto(roomUrl), max.goto(roomUrl)]);
await olivia.getByRole("button", { name: "Join study room" }).click();
await olivia.getByRole("button", { name: "Leave", exact: true }).waitFor();
await max.getByRole("button", { name: "Join study room" }).click();
const voice = await Promise.all([
  olivia.locator('li[data-connection="connected"]', { hasText: "Max" }).waitFor({ timeout: 20000 }).then(() => true, () => false),
  max.locator('li[data-connection="connected"]', { hasText: "Olivia" }).waitFor({ timeout: 20000 }).then(() => true, () => false),
]);
check("study room voice connects behind a buffering proxy", voice.every(Boolean));

await browser.close();
proxy.close();
summary();
