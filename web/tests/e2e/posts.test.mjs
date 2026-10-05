import { out } from "./helpers.mjs";
import { B, T, browser, check, emailFor, newPage, submitAuth, summary } from "./helpers.mjs";
async function signup(page, name) {
  await page.goto(`${B}/signup`);
  await page.fill("input[name=name]", name);
  await page.fill("input[name=email]", emailFor(name));
  await page.fill("input[name=password]", "secret123");
  await submitAuth(page, "**/dashboard");
}
async function createCommunity(page, name, visibility = "public") {
  await page.goto(`${B}/communities/new`);
  await page.fill("input[name=name]", name);
  await page.check(`input[value=${visibility}]`);
  await page.click("button[type=submit]");
  await page.waitForURL("**/c/**");
  return page.url();
}
async function share(page, communityUrl, { type, url = "", title = "", body = "" }) {
  await page.goto(`${communityUrl}/new`);
  await page.getByRole("button", { name: type, exact: true }).click();
  if (type !== "Note") await page.fill("input[name=url]", url);
  await page.fill("input[name=title]", title);
  await page.fill("textarea[name=body]", body);
  await page.click("button[type=submit]");
}
const alertText = async (page) => { const a = page.locator("form p[role=alert]"); await a.waitFor({ timeout: 8000 }).catch(() => {}); return (await a.count()) ? a.innerText() : ""; };

const olivia = await newPage();
await signup(olivia, "Olivia");
const cUrl = await createCommunity(olivia, `Web Dev ${T}`);
check("empty feed message", await olivia.getByText("No posts yet").isVisible());

// Video with empty title -> title from YouTube
await share(olivia, cUrl, { type: "Video", url: "https://youtu.be/dQw4w9WgXcQ?si=abc", body: "Classic" });
await olivia.waitForURL("**/p/**", { timeout: 15000 });
const videoPostUrl = olivia.url();
check("video title auto-filled from YouTube", (await olivia.locator("h1").innerText()).includes("Rick Astley"));
check("video embedded via youtube-nocookie", (await olivia.locator("iframe").getAttribute("src")) === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");

// Non-YouTube video rejected
await share(olivia, cUrl, { type: "Video", url: "https://vimeo.com/123456" });
check("non-YouTube video rejected", (await alertText(olivia)).includes("Only YouTube"));
check("form keeps typed link after error", (await olivia.inputValue("input[name=url]")) === "https://vimeo.com/123456");

// Article with preview
await share(olivia, cUrl, { type: "Article", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" });
await olivia.waitForURL("**/p/**", { timeout: 15000 });
check("article title from page", (await olivia.locator("h1").innerText()).includes("JavaScript"));
const articleLink = olivia.getByRole("link", { name: /Read article/ });
check("article card opens in new tab safely", (await articleLink.getAttribute("target")) === "_blank" && (await articleLink.getAttribute("rel")).includes("noopener"));

// SSRF attempt: internal URL creates post without preview
await share(olivia, cUrl, { type: "Article", url: "http://localhost:3000/dashboard" });
await olivia.waitForURL("**/p/**", { timeout: 15000 });
check("internal URL: no preview fetched, title falls back to host", (await olivia.locator("h1").innerText()) === "localhost" && (await olivia.locator("article img").count()) === 0);

// Note validation and XSS
await olivia.goto(`${cUrl}/new`);
await olivia.getByRole("button", { name: "Note", exact: true }).click();
await olivia.$eval("textarea[name=body]", (el) => el.removeAttribute("required"));
await olivia.fill("input[name=title]", "Closures explained");
await olivia.click("button[type=submit]");
check("note without body rejected", (await alertText(olivia)).includes("Write something"));
await olivia.fill("textarea[name=body]", "A closure keeps its scope.\n<script>window.__xss=1</script><b>bold?</b>");
await olivia.click("button[type=submit]");
await olivia.waitForURL("**/p/**");
check("HTML in note shown as text, not executed", (await olivia.evaluate(() => window.__xss)) === undefined && (await olivia.getByText("<b>bold?</b>").count()) === 1);

// Feed
await olivia.goto(cUrl);
const titles = await olivia.locator('a[href*="/p/"] h3').allInnerTexts();
check("feed shows 4 posts newest first", titles.length === 4 && titles[0] === "Closures explained", JSON.stringify(titles.map((t) => t.slice(0, 20))));
check("new posts show \"just now\"", (await olivia.getByText("Olivia · just now").count()) === 4);
check("feed shows video thumbnail", (await olivia.locator('img[src*="i.ytimg.com"]').count()) === 1);

// Non-member
const max = await newPage();
await signup(max, "Max");
await max.goto(cUrl);
check("non-member can read public feed", (await max.locator('main a[href*="/p/"]').count()) === 4);
check("non-member sees Join, not Share", (await max.getByRole("button", { name: "Join community" }).first().isVisible()) && (await max.getByRole("link", { name: "Share something" }).count()) === 0);
await max.goto(`${cUrl}/new`);
check("non-member redirected away from share page", max.url() === cUrl);

// Member posts; delete permissions
await max.getByRole("button", { name: "Join community" }).first().click();
await max.getByRole("link", { name: "Share something" }).first().waitFor();
await share(max, cUrl, { type: "Note", title: "Max's question", body: "How does hoisting work?" });
await max.waitForURL("**/p/**");
const maxPostUrl = max.url();
check("author sees Delete on own post", await max.getByRole("button", { name: "Delete post" }).isVisible());
await max.goto(videoPostUrl);
check("member can't delete others' posts", (await max.getByRole("button", { name: "Delete post" }).count()) === 0);
await olivia.goto(maxPostUrl);
await olivia.getByRole("button", { name: "Delete post" }).click();
await olivia.waitForURL(cUrl);
check("owner deleted member's post", (await olivia.getByText("Max's question").count()) === 0);
const gone = await olivia.goto(maxPostUrl);
check("deleted post 404s", gone.status() === 404);

// Members tab
await olivia.goto(`${cUrl}/members`);
check("members tab lists 2 members with invite link", (await olivia.locator("main li").count()) === 2 && (await olivia.getByLabel("Invite link").isVisible()));

// Private community post not visible to non-member; cross-community URL 404s
const privUrl = await createCommunity(olivia, `Private ${T}`, "private");
await share(olivia, privUrl, { type: "Note", title: "Secret notes", body: "members only" });
await olivia.waitForURL("**/p/**");
const privPostUrl = olivia.url();
const r1 = await max.goto(privPostUrl);
check("private post 404s for non-member", r1.status() === 404);
const postId = privPostUrl.split("/p/")[1];
const r2 = await max.goto(`${cUrl}/p/${postId}`);
check("post can't be read through another community's URL", r2.status() === 404);

// Screenshots
await olivia.setViewportSize({ width: 1100, height: 900 });
await olivia.goto(cUrl);
await olivia.screenshot({ path: out("feed-desktop.png") });
await olivia.goto(videoPostUrl);
await olivia.screenshot({ path: out("video-post.png") });
await olivia.setViewportSize({ width: 390, height: 800 });
await olivia.goto(`${cUrl}/new`);
await olivia.screenshot({ path: out("share-mobile.png") });

await browser.close();
summary();
