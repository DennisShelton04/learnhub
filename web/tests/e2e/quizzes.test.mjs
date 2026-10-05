import { T, browser, check, createCommunity, join, newUser, shareNote, summary } from "./helpers.mjs";

const olivia = await newUser("Olivia");
const cUrl = await createCommunity(olivia, `Quiz ${T}`);
const postUrl = await shareNote(olivia, cUrl, "Closures 101", "A closure remembers its scope.");

// Builder opened from the post, pre-linked
await olivia.getByRole("link", { name: "Create a quiz on this" }).click();
await olivia.waitForURL("**/quizzes/new?post=**");
check("builder pre-links the post", (await olivia.locator("select").inputValue()) === postUrl.split("/p/")[1]);

// Server-side validation
await olivia.$eval('input[placeholder^="e.g."]', (el) => el.removeAttribute("minlength"));
await olivia.fill('input[placeholder^="e.g."]', "ab");
await olivia.getByLabel("Question 1", { exact: true }).fill("x");
await olivia.getByLabel("Question 1, answer 1").fill("a");
await olivia.getByLabel("Question 1, answer 2").fill("b");
await olivia.getByRole("button", { name: /Create quiz/ }).click();
check("server rejects too-short title", await olivia.getByRole("alert").filter({ hasText: "at least 3" }).waitFor({ timeout: 5000 }).then(() => true, () => false));

// Build a 3-question quiz
await olivia.fill('input[placeholder^="e.g."]', "Closures check");
const q = (n) => ({
  prompt: olivia.getByLabel(`Question ${n}`, { exact: true }),
  ans: (i) => olivia.getByLabel(`Question ${n}, answer ${i}`),
  correct: (i) => olivia.locator("main ol > li").nth(n - 1).getByRole("button", { name: `Mark answer ${i} as correct` }),
  explain: olivia.getByLabel(`Question ${n} explanation`),
});
await q(1).prompt.fill("What does a closure remember?");
await q(1).ans(1).fill("Its lexical scope");
await q(1).ans(2).fill("The DOM");
await olivia.getByRole("button", { name: "+ Add answer" }).first().click();
await q(1).ans(3).fill("Nothing");
await q(1).correct(1).click();
await q(1).explain.fill("Closures capture variables from where they were defined.");
await olivia.getByRole("button", { name: "Add question" }).click();
await q(2).prompt.fill("Which keyword creates block scope?");
await q(2).ans(1).fill("var");
await q(2).ans(2).fill("let");
await q(2).correct(2).click();
await q(2).explain.fill("let and const are block scoped; var is function scoped.");
await olivia.getByRole("button", { name: "Add question" }).click();
await q(3).prompt.fill("Closures work in JavaScript?");
await q(3).ans(1).fill("Yes");
await q(3).ans(2).fill("No");
await q(3).correct(1).click();
await olivia.getByRole("button", { name: "Create quiz (3 questions)" }).click();
await olivia.waitForURL("**/q/**");
const quizUrl = olivia.url();
check("quiz created with 3 questions", await olivia.getByText("3 questions · instant feedback").isVisible());
check("quiz listed in sidebar", (await olivia.locator('aside a[href*="/q/"]', { hasText: "Closures check" }).count()) === 1);
check("linked post shown", await olivia.getByRole("link", { name: "Closures 101" }).first().isVisible());

// Olivia plays: right, wrong, right — and verify answers aren't leaked before answering
const leaks = [];
let answered = false;
olivia.on("response", async (r) => {
  if (r.request().method() !== "POST" || answered) return;
  const body = await r.text().catch(() => "");
  if (/isCorrect|is_correct|correctOptionId|correctIndex/.test(body)) leaks.push(r.url());
});
await olivia.getByRole("button", { name: "Start quiz" }).click();
await olivia.getByText("Question 1 of 3").waitFor();
await olivia.waitForTimeout(500);
check("correct answers not sent to browser before answering", leaks.length === 0, leaks.join(","));
answered = true;
const pick = async (page, text) => { await page.getByRole("group", { name: "Answers" }).getByRole("button", { name: text }).click(); };
await pick(olivia, "Its lexical scope");
check("correct answer gets feedback + explanation", await olivia.getByText("Correct!").waitFor().then(() => olivia.getByText("Closures capture variables").isVisible()));
await olivia.getByRole("button", { name: "Next question" }).click();
await pick(olivia, "var");
await olivia.getByText("Not quite.").waitFor();
check("wrong answer reveals correct one", (await olivia.getByLabel("Correct answer").count()) === 1 && (await olivia.getByLabel("Your answer").count()) === 1);
check("answers locked after choosing", await olivia.getByRole("group", { name: "Answers" }).getByRole("button", { name: "let" }).isDisabled());
await olivia.getByRole("button", { name: "Next question" }).click();
await pick(olivia, "Yes");
await olivia.getByRole("button", { name: "See results" }).click();
check("final score 2/3", await olivia.getByRole("heading", { name: "2 / 3" }).waitFor().then(() => true, () => false));
await olivia.waitForTimeout(800);
check("leaderboard shows Olivia 2/3", await olivia.locator("ol li", { hasText: "Olivia" }).getByText("2/3").isVisible());

// Max: non-member can't play; after joining scores 3/3
const max = await newUser("Max");
await max.goto(quizUrl);
check("non-member asked to join", await max.getByText("Join this community to take the quiz").isVisible());
await join(max, cUrl);
await max.goto(quizUrl);
await max.getByRole("button", { name: "Start quiz" }).click();
for (const ans of ["Its lexical scope", "let", "Yes"]) {
  await max.getByText(/Question \d of 3/).waitFor();
  await pick(max, ans);
  await max.getByText("Correct!").waitFor();
  await max.getByRole("button", { name: /Next question|See results/ }).click();
}
await max.getByRole("heading", { name: "3 / 3" }).waitFor();
await max.waitForTimeout(800);
const ranks = await max.locator("ol li").allInnerTexts();
check("leaderboard ranks Max first", ranks[0]?.includes("Max") && ranks[1]?.includes("Olivia"), JSON.stringify(ranks.map((r) => r.replace(/\s+/g, " "))));

// Retake with a worse score keeps best
await max.getByRole("button", { name: "Try again" }).click();
await max.getByRole("button", { name: "Start quiz" }).click();
for (const ans of ["The DOM", "var", "No"]) {
  await max.getByText(/Question \d of 3/).waitFor();
  await pick(max, ans);
  await max.getByText("Not quite.").waitFor();
  await max.getByRole("button", { name: /Next question|See results/ }).click();
}
await max.getByRole("heading", { name: "0 / 3" }).waitFor();
await max.waitForTimeout(800);
const maxRows = max.locator("ol li", { hasText: "Max" });
check("leaderboard keeps best score, one row per person", (await maxRows.count()) === 1 && (await maxRows.getByText("3/3").isVisible()));

// Post page shows quiz chip
await max.goto(postUrl);
check("post shows its quiz", await max.getByRole("link", { name: /Closures check · 3Q/ }).isVisible());

// Delete permissions
await max.goto(quizUrl);
check("member can't delete others' quiz", (await max.getByRole("button", { name: /Delete quiz/ }).count()) === 0);
await olivia.goto(quizUrl);
await olivia.getByRole("button", { name: /Delete quiz/ }).click();
await olivia.waitForURL(cUrl);
check("owner deleted quiz; gone from sidebar", (await olivia.locator('aside a[href*="/q/"]').count()) === 0);
const gone = await olivia.goto(quizUrl);
check("deleted quiz 404s", gone.status() === 404);

// Private community quiz hidden
const privUrl = await createCommunity(olivia, `PrivQuiz ${T}`, "private");
await olivia.goto(`${privUrl}/quizzes/new`);
await olivia.fill('input[placeholder^="e.g."]', "Secret quiz");
await olivia.getByLabel("Question 1", { exact: true }).fill("Q?");
await olivia.getByLabel("Question 1, answer 1").fill("A");
await olivia.getByLabel("Question 1, answer 2").fill("B");
await olivia.getByRole("button", { name: /Create quiz/ }).click();
await olivia.waitForURL("**/q/**");
const privRes = await max.goto(olivia.url());
check("private quiz 404s for non-member", privRes.status() === 404);

// Screenshot of a question in progress
await max.goto(cUrl);
await olivia.goto(privUrl.replace(/\/$/, ""));
await olivia.goto(olivia.url());
await max.setViewportSize({ width: 1280, height: 860 });
await max.goto(quizUrl).catch(() => {});
await browser.close();
summary();
