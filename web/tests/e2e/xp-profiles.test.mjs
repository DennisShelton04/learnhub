import { emailFor, out } from "./helpers.mjs";
import { T, browser, check, createCommunity, join, live, newUser, shareNote, summary } from "./helpers.mjs";
const panel = (page) => page.getByRole("link", { name: "Your profile" });
const panelText = async (page) => (await panel(page).innerText()).replace(/\s+/g, " ");

const olivia = await newUser("Olivia");
check("new user starts at level 1, 0 XP", (await panelText(olivia)).includes("Level 1 · 0 XP"), await panelText(olivia));
const cUrl = await createCommunity(olivia, `XP ${T}`);
await shareNote(olivia, cUrl, "Notes on recursion");            // +10
await live(olivia);
// Two messages back-to-back, without waiting in between                       // +2 +2
const box = olivia.getByRole("textbox", { name: "Message" });
await box.fill("msg first"); await box.press("Enter");
await box.fill("msg second"); await box.press("Enter");
const sent = (t) => olivia.locator("p.whitespace-pre-wrap", { hasText: t }).waitFor({ timeout: 5000 }).then(() => true, () => false);
check("rapid back-to-back messages are both sent", (await sent("msg first")) && (await sent("msg second")));
// Quiz: create (+15), perfect run 2/2 (+5 +2*2 +10 = +19)
await olivia.goto(`${cUrl}/quizzes/new`);
await olivia.fill('input[placeholder^="e.g."]', "Recursion quiz");
await olivia.getByLabel("Question 1", { exact: true }).fill("Base case needed?");
await olivia.getByLabel("Question 1, answer 1").fill("Yes"); await olivia.getByLabel("Question 1, answer 2").fill("No");
await olivia.getByRole("button", { name: "Add question" }).click();
await olivia.getByLabel("Question 2", { exact: true }).fill("Recursion calls itself?");
await olivia.getByLabel("Question 2, answer 1").fill("Yes"); await olivia.getByLabel("Question 2, answer 2").fill("No");
await olivia.getByRole("button", { name: /Create quiz/ }).click();
await olivia.waitForURL("**/q/**");
const playAll = async (page, answer) => {
  await page.getByRole("button", { name: "Start quiz" }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByText(/Question \d of 2/).waitFor();
    await page.getByRole("group", { name: "Answers" }).getByRole("button", { name: answer }).click();
    await page.getByRole("button", { name: /Next question|See results/ }).click();
  }
  await page.getByRole("heading", { name: /\d \/ 2/ }).waitFor();
};
await playAll(olivia, "Yes");
check("perfect quiz shows +19 XP", await olivia.getByText("+19 XP").isVisible());
await olivia.getByRole("button", { name: "Try again" }).click();
await playAll(olivia, "Yes");
check("retaking a quiz gives no extra XP", (await olivia.getByText(/\+\d+ XP/).count()) === 0);

await olivia.reload();
check("panel shows 48 XP and a 1-day streak", (await panelText(olivia)).includes("Level 1 · 48 XP · 🔥 1"), await panelText(olivia));

// Profile
await panel(olivia).click();
await olivia.waitForURL("**/u/**");
const profileUrl = olivia.url();
check("profile shows XP and progress to level 2", (await olivia.getByText("2 XP to level 2").isVisible()) && (await olivia.getByText("48", { exact: true }).isVisible()));
const earned = await olivia.locator("li.bg-accent-soft").allInnerTexts();
check("earned badges: First share, Quiz maker, Perfectionist", earned.length === 3 && ["First share", "Quiz maker", "Perfectionist"].every((b) => earned.some((e) => e.includes(b))), JSON.stringify(earned.map((e) => e.split("\n")[0])));

// Daily cap: Max shares 6 posts but only 5 earn XP
const max = await newUser("Max");
await join(max, cUrl);
for (let i = 1; i <= 6; i++) await shareNote(max, cUrl, `Max note ${i}`);
await max.reload();
check("daily cap: 6 posts earn 50 XP, not 60", (await panelText(max)).includes("50 XP"), await panelText(max));

// Leaderboard
await max.goto(`${cUrl}/leaderboard`);
const rows = (await max.locator("main ol li").allInnerTexts()).map((r) => r.replace(/\s+/g, " "));
check("weekly leaderboard ranks Max (50) then Olivia (48)", rows[0]?.includes("Max") && rows[0]?.includes("50 XP") && rows[1]?.includes("Olivia") && rows[1]?.includes("48 XP"), JSON.stringify(rows));
await max.getByRole("link", { name: "All time" }).click();
await max.waitForURL("**period=all");
check("all-time tab works", (await max.locator("main ol li").count()) === 2);

// Profile privacy
await createCommunity(olivia, `Secret ${T}`, "private");
await max.goto(profileUrl);
const comms = await max.locator("main a[href^='/c/']").allInnerTexts();
check("profile hides private communities from non-members", comms.some((c) => c.includes(`XP ${T}`)) && !comms.some((c) => c.includes(`Secret ${T}`)), JSON.stringify(comms.map((c) => c.split("\n")[1] ?? c)));
check("profile doesn't show email", !(await max.content()).includes(emailFor("olivia")));
await olivia.goto(profileUrl);
check("owner sees own private community on profile", (await olivia.locator("main a[href^='/c/']", { hasText: `Secret ${T}` }).count()) === 1);

await olivia.setViewportSize({ width: 1280, height: 900 });
await olivia.screenshot({ path: out("profile.png") });
await max.setViewportSize({ width: 1280, height: 700 });
await max.goto(`${cUrl}/leaderboard`);
await max.screenshot({ path: out("leaderboard.png") });
await browser.close();
summary();
