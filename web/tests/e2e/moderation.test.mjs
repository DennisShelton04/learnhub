import { T, browser, check, createCommunity, join, live, newUser, shareNote, summary } from "./helpers.mjs";
const say = async (page, text) => {
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill(text); await box.press("Enter");
  await page.locator("p.whitespace-pre-wrap", { hasText: text }).waitFor();
};
const row = (page, text) => page.locator("li", { has: page.locator("p.whitespace-pre-wrap", { hasText: text }) }).last();
const dialog = (page) => page.locator("dialog[open]");
async function reportMessage(page, text, reason, details = "") {
  await row(page, text).hover();
  await row(page, text).getByRole("button", { name: "Report message" }).click();
  // Move the mouse away from the toolbar before using the dialog.
  await page.mouse.move(5, 5);
  await dialog(page).getByLabel(reason).check();
  if (details) await dialog(page).getByRole("textbox").fill(details);
  await dialog(page).getByRole("button", { name: "Report", exact: true }).click();
}

const olivia = await newUser("Olivia");
const cUrl = await createCommunity(olivia, `Mod ${T}`);
const postUrl = await shareNote(olivia, cUrl, "Study thread");
const max = await newUser("Max");
const nina = await newUser("Nina");
await join(max, cUrl); await join(nina, cUrl);
await nina.goto(postUrl); await live(nina);
await say(nina, "BUY CHEAP COINS now!!!");
await max.goto(postUrl); await live(max);
await say(max, "Here is my honest question");

check("no report button on your own message", (await row(max, "my honest question").getByRole("button", { name: "Report message" }).count()) === 0);
await reportMessage(max, "BUY CHEAP COINS", "Spam or advertising", "Advert, not learning");
check("report dialog works after mouse leaves toolbar", await dialog(max).getByText("Thanks for reporting").waitFor({ timeout: 5000 }).then(() => true, () => false));
await dialog(max).getByRole("button", { name: "Done" }).click();
await reportMessage(max, "BUY CHEAP COINS", "Harassment or bullying");
check("duplicate report rejected", await dialog(max).getByRole("alert").filter({ hasText: "already reported" }).waitFor({ timeout: 5000 }).then(() => true, () => false));
await dialog(max).getByRole("button", { name: "Cancel" }).click();
await nina.reload(); await live(nina);
await reportMessage(nina, "my honest question", "Harassment or bullying");
await dialog(nina).getByText("Thanks for reporting").waitFor();

// Report a post too (Nina's post, reported by Max)
const ninaPost = await shareNote(nina, cUrl, "Totally legit offer", "click here");
await max.goto(ninaPost);
await max.getByRole("button", { name: "Report" }).click();
await dialog(max).getByLabel("Spam or advertising").check();
await dialog(max).getByRole("button", { name: "Report", exact: true }).click();
await dialog(max).getByText("Thanks for reporting").waitFor();

// Access: members can't see moderation
check("members have no moderation link", (await max.getByRole("link", { name: /^moderation/ }).count()) === 0);
const denied = await max.goto(`${cUrl}/moderation`);
check("members get 404 on moderation page", denied.status() === 404);

// Owner queue
await olivia.goto(cUrl);
const badge = olivia.getByRole("link", { name: /moderation/ }).getByLabel("3 open");
check("sidebar badge shows 3 reported items", await badge.isVisible());
await olivia.goto(`${cUrl}/moderation`);
const items = olivia.locator("main li", { has: olivia.getByRole("button", { name: /Dismiss|Close/ }) });
check("queue lists 3 items", (await items.count()) === 3);
const coins = items.filter({ hasText: "BUY CHEAP COINS" });
check("queue shows reason, details and preview", (await coins.getByText("Spam", { exact: true }).isVisible()) && (await coins.getByText("“Advert, not learning”").isVisible()));

// Dismiss the bogus report; remove the spam message and post (Max watches the chat live)
await max.goto(postUrl); await live(max);
check("spam visible to Max before review", await max.locator("p.whitespace-pre-wrap", { hasText: "BUY CHEAP COINS" }).isVisible());
await items.filter({ hasText: "my honest question" }).getByRole("button", { name: "Dismiss" }).click();
await items.filter({ hasText: "my honest question" }).waitFor({ state: "detached" });
await coins.getByRole("button", { name: "Remove message" }).click();
await coins.waitFor({ state: "detached" });
check("removed message disappears live from chat", await max.locator("p.whitespace-pre-wrap", { hasText: "BUY CHEAP COINS" }).waitFor({ state: "detached", timeout: 5000 }).then(() => true, () => false));
check("dismissed message stays", await max.locator("p.whitespace-pre-wrap", { hasText: "my honest question" }).isVisible());
await items.filter({ hasText: "Totally legit offer" }).getByRole("button", { name: "Remove post" }).click();
await olivia.getByText("All clear").waitFor();
check("queue empty after review", true);
const postGone = await max.goto(ninaPost);
check("removed post 404s", postGone.status() === 404);
await olivia.goto(cUrl);
check("badge cleared", (await olivia.getByRole("link", { name: /moderation/ }).getByLabel(/open/).count()) === 0);

// Moderators get access too
await olivia.goto(`${cUrl}/members`);
await olivia.locator("main li", { hasText: "Max" }).getByRole("button", { name: "Make moderator" }).click();
await olivia.locator("main li", { hasText: "Max" }).getByRole("button", { name: "Remove moderator" }).waitFor();
const modView = await max.goto(`${cUrl}/moderation`);
check("moderators can open the queue", modView.status() === 200 && (await max.getByText("All clear").isVisible()));

await browser.close();
summary();
