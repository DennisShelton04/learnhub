import { out } from "./helpers.mjs";
import { B, T, browser, check, emailFor, newPage, submitAuth, summary } from "./helpers.mjs";
async function signup(page, name) {
  await page.goto(`${B}/signup`);
  await page.fill("input[name=name]", name);
  await page.fill("input[name=email]", emailFor(name));
  await page.fill("input[name=password]", "secret123");
  await submitAuth(page, "**/dashboard");
}
const live = (page) => page.getByText("Live", { exact: true }).waitFor({ timeout: 10000 });
const composer = (page) => page.getByRole("textbox", { name: "Message", exact: true });
const row = (page, text) => page.locator("li", { has: messageBody(page, text) }).last();
const act = async (page, text, name) => { await row(page, text).hover(); await row(page, text).getByRole("button", { name, exact: true }).click(); };
const say = async (page, text) => { await composer(page).fill(text); await composer(page).press("Enter"); };
const messageBody = (page, text) => page.locator("p.whitespace-pre-wrap", { hasText: text });
const appears = (page, text, ms = 5000) => messageBody(page, text).first().waitFor({ timeout: ms }).then(() => true, () => false);

// Setup: Olivia's community and a note post
const olivia = await newPage();
await signup(olivia, "Olivia");
await olivia.goto(`${B}/communities/new`);
await olivia.fill("input[name=name]", `Chat ${T}`);
await olivia.click("button[type=submit]");
await olivia.waitForURL("**/c/**");
const cUrl = olivia.url();
await olivia.goto(`${cUrl}/new`);
await olivia.getByRole("button", { name: "Note", exact: true }).click();
await olivia.fill("input[name=title]", "What is a closure?");
await olivia.fill("textarea[name=body]", "Let's discuss.");
await olivia.click("button[type=submit]");
await olivia.waitForURL("**/p/**");
const postUrl = olivia.url();
await live(olivia);
check("owner connects to live discussion", true);
check("empty discussion message", await olivia.getByText("No messages yet").isVisible());

// Non-member view
const max = await newPage();
await signup(max, "Max");
await max.goto(postUrl);
check("non-member sees join prompt instead of composer", (await max.getByText("Join this community to take part").isVisible()) && (await composer(max).count()) === 0);

// Max joins and opens the post
await max.goto(cUrl);
await max.getByRole("button", { name: "Join community" }).first().click();
await max.getByRole("link", { name: "Share something" }).first().waitFor();
await max.goto(postUrl);
await live(max);

// Live delivery both ways
check("send button disabled when empty", await max.getByRole("button", { name: "Send" }).isDisabled());
await say(olivia, `Hello Max ${T}`);
check("owner's message shows for owner", await appears(olivia, `Hello Max ${T}`));
check("message arrives live for other user (no reload)", await appears(max, `Hello Max ${T}`));
check("composer cleared after sending", (await composer(olivia).inputValue()) === "");

// Multi-line + XSS as text
await composer(max).fill("Line one");
await composer(max).press("Shift+Enter");
await composer(max).type("Line two <img src=x onerror=window.__xss=1>");
await composer(max).press("Enter");
check("multi-line message arrives live", await appears(olivia, "Line two"));
const multi = await messageBody(olivia, "Line two").first().innerText();
check("newline preserved and HTML shown as text", multi.includes("Line one\nLine two") && multi.includes("<img") && (await olivia.evaluate(() => window.__xss)) === undefined);

// Reply with a reference to the original message
await act(max, `Hello Max ${T}`, "Reply");
const replyBox = max.getByRole("textbox", { name: "Reply to Olivia" });
await replyBox.fill("Reply from Max");
await replyBox.press("Enter");
check("reply arrives live for owner", await appears(olivia, "Reply from Max"));
check("reply shows reference to original", (await row(olivia, "Reply from Max").getByText("@Olivia").count()) === 1);
await act(olivia, "Reply from Max", "Reply");
const replyBox2 = olivia.getByRole("textbox", { name: "Reply to Max" });
await replyBox2.fill("Reply to the reply");
await replyBox2.press("Enter");
check("reply-to-reply references the reply", (await appears(max, "Reply to the reply")) && (await row(max, "Reply to the reply").getByText("@Max").count()) === 1);

// Delete permissions
check("member can't delete owner's message", (await row(max, `Hello Max ${T}`).getByRole("button", { name: "Delete message" }).count()) === 0);
check("owner can delete member's message", (await row(olivia, "Line two").getByRole("button", { name: "Delete message" }).count()) === 1);
await act(max, "Line two", "Delete message");
const goneForOlivia = await messageBody(olivia, "Line two").waitFor({ state: "detached", timeout: 5000 }).then(() => true, () => false);
check("deleted message disappears live for others", goneForOlivia);

// Deleting a message that was replied to
await act(olivia, `Hello Max ${T}`, "Delete message");
await max.getByText("Original message was deleted").waitFor({ timeout: 5000 }).catch(() => {});
check("reply to a deleted message shows placeholder", (await max.getByText("Original message was deleted").count()) === 1 && (await appears(max, "Reply from Max", 1000)));

// Reload shows persisted state
await max.reload();
await live(max);
check("messages persist after reload", (await appears(max, "Reply from Max")) && (await messageBody(max, "Line two").count()) === 0);
check("message count shown", await max.getByText("Discussion · 2 messages").isVisible());

// Feed count
await olivia.goto(cUrl);
check("feed shows message count", await olivia.getByText("2 messages").isVisible());

// Private community: APIs closed to non-members
await olivia.goto(`${B}/communities/new`);
await olivia.fill("input[name=name]", `Private chat ${T}`);
await olivia.check("input[value=private]");
await olivia.click("button[type=submit]");
await olivia.waitForURL("**/c/**");
await olivia.goto(`${olivia.url()}/new`);
await olivia.getByRole("button", { name: "Note", exact: true }).click();
await olivia.fill("input[name=title]", "secret");
await olivia.fill("textarea[name=body]", "secret");
await olivia.click("button[type=submit]");
await olivia.waitForURL("**/p/**");
const privPostId = olivia.url().split("/p/")[1];
const listRes = await max.request.get(`${B}/api/posts/${privPostId}/messages`);
const evRes = await max.request.get(`${B}/api/posts/${privPostId}/events`, { timeout: 5000 });
check("private post messages/events hidden from non-member", listRes.status() === 404 && evRes.status() === 404, `${listRes.status()}/${evRes.status()}`);

await olivia.goto(postUrl);
await live(olivia);
await olivia.setViewportSize({ width: 1000, height: 1000 });
await olivia.screenshot({ path: out("discussion.png"), fullPage: true });
await max.setViewportSize({ width: 390, height: 844 });
await max.screenshot({ path: out("discussion-mobile.png"), fullPage: true });

await browser.close();
summary();
