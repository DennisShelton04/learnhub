import { B, T, browser, check, createCommunity, join, live, newUser, shareNote, summary } from "./helpers.mjs";
const bell = (p) => p.getByRole("link", { name: /^Notifications/ });
const bellCount = async (p) => (await bell(p).getAttribute("aria-label")).match(/(\d+) unread/)?.[1] ?? "0";
const waitBell = (p, n) => p.getByRole("link", { name: n === 0 ? "Notifications" : `Notifications, ${n} unread`, exact: true }).waitFor({ timeout: 6000 }).then(() => true, () => false);
const say = async (p, text) => {
  const box = p.getByRole("textbox", { name: "Message" });
  await box.fill(text); await box.press("Enter");
  await p.locator("p.whitespace-pre-wrap", { hasText: text }).waitFor();
};

const olivia = await newUser("Olivia");
const cUrl = await createCommunity(olivia, `Notify ${T}`);
const postUrl = await shareNote(olivia, cUrl, "Graph algorithms");
await live(olivia);
await say(olivia, "Own comment shouldn't notify me");
check("own activity doesn't notify", (await bellCount(olivia)) === "0");

const max = await newUser("Max");
await join(max, cUrl);
await max.goto(postUrl); await live(max);
await say(max, "BFS or DFS first?");
check("comment on your post notifies live (no reload)", await waitBell(olivia, 1));
await say(max, "Also, what about Dijkstra?");
await olivia.waitForTimeout(1500);
check("more comments are grouped into one notification", (await bellCount(olivia)) === "1");

// Olivia replies to Max
const row = olivia.locator("li", { has: olivia.locator("p.whitespace-pre-wrap", { hasText: "BFS or DFS first?" }) }).last();
await row.hover(); await row.getByRole("button", { name: "Reply", exact: true }).click();
await olivia.getByRole("textbox", { name: "Reply to Max" }).fill("Start with BFS!");
await olivia.getByRole("textbox", { name: "Reply to Max" }).press("Enter");
check("reply notifies the person replied to", await waitBell(max, 1));

// Open from the notifications page
await olivia.goto(`${B}/notifications`);
const item = olivia.getByRole("button", { name: /Max commented on “Graph algorithms”/ });
check("notification shows latest message", await item.getByText("Also, what about Dijkstra?").isVisible());
check("unread marker shown", (await olivia.getByLabel("Unread", { exact: true }).count()) === 1);
await item.click();
await olivia.waitForURL(`**/p/**`);
check("opening a notification goes to the message", olivia.url().startsWith(postUrl));
check("opening marks it read", await waitBell(olivia, 0));

// Battle invite
await olivia.goto(`${cUrl}/quizzes/new`);
await olivia.fill('input[placeholder^="e.g."]', "Graphs quiz");
await olivia.getByLabel("Question 1", { exact: true }).fill("BFS uses a?");
await olivia.getByLabel("Question 1, answer 1").fill("Queue"); await olivia.getByLabel("Question 1, answer 2").fill("Stack");
await olivia.getByRole("button", { name: /Create quiz/ }).click();
await olivia.waitForURL("**/q/**");
await olivia.getByRole("button", { name: "Host live battle" }).click();
await olivia.waitForURL("**/b/**");
check("battle invite notifies members live", await waitBell(max, 2));
await max.goto(`${B}/notifications`);
await max.getByRole("button", { name: /Olivia is hosting a live quiz battle/ }).click();
await max.waitForURL("**/b/**");
check("battle notification opens the lobby", await max.getByRole("button", { name: "Join battle" }).isVisible());
await max.goto(`${B}/notifications`);
await max.getByRole("button", { name: "Mark all as read" }).click();
check("mark all as read", await waitBell(max, 0));

// PWA + headers
const manifest = await (await max.request.get(`${B}/manifest.webmanifest`)).json();
check("manifest is installable (name, standalone, 192+512 icons)", manifest.name === "LearnHub" && manifest.display === "standalone" && ["192x192", "512x512"].every((s) => manifest.icons.some((i) => i.sizes === s)));
const iconOk = (await Promise.all(manifest.icons.map((i) => max.request.get(B + i.src)))).every((r) => r.ok() && r.headers()["content-type"] === "image/png");
check("manifest icons are served", iconOk);
const html = await (await max.request.get(`${B}/`)).text();
check("pages link the manifest and apple touch icon", html.includes('rel="manifest"') && html.includes("apple-touch-icon"));
const h = (await max.request.get(`${B}/`)).headers();
check("security headers set", h["x-frame-options"] === "DENY" && h["x-content-type-options"] === "nosniff" && h["permissions-policy"]?.includes("microphone=(self)"));

await browser.close();
summary();
