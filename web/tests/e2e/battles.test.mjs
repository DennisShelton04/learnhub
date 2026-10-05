import { B, T, browser, check, createCommunity, join, newUser, summary } from "./helpers.mjs";

const olivia = await newUser("Olivia");
const cUrl = await createCommunity(olivia, `Battle ${T}`);
await olivia.goto(`${cUrl}/quizzes/new`);
await olivia.fill('input[placeholder^="e.g."]', "Speed round");
await olivia.getByLabel("Question 1", { exact: true }).fill("2 + 2 = ?");
await olivia.getByLabel("Question 1, answer 1").fill("4"); await olivia.getByLabel("Question 1, answer 2").fill("5");
await olivia.getByLabel("Question 1 explanation").fill("Basic addition.");
await olivia.getByRole("button", { name: "Add question" }).click();
await olivia.getByLabel("Question 2", { exact: true }).fill("Capital of France?");
await olivia.getByLabel("Question 2, answer 1").fill("Paris"); await olivia.getByLabel("Question 2, answer 2").fill("Rome");
await olivia.getByRole("button", { name: /Create quiz/ }).click();
await olivia.waitForURL("**/q/**");

await olivia.getByRole("button", { name: "Host live battle" }).click();
await olivia.waitForURL("**/b/**");
const battleUrl = olivia.url();
const battleId = battleUrl.split("/b/")[1];
check("host lands in lobby with Start button", await olivia.getByRole("button", { name: "Start battle" }).isVisible());
check("sidebar shows the live battle", await olivia.locator("aside").getByRole("link", { name: /Speed round · 1 player/ }).isVisible());

const max = await newUser("Max"); const nina = await newUser("Nina");
for (const p of [max, nina]) { await join(p, cUrl); await p.goto(battleUrl); await p.getByRole("button", { name: "Join battle" }).click(); await p.getByText("You're in!").waitFor(); }
const lobbyCount = await olivia.getByText("Players — 3").waitFor({ timeout: 5000 }).then(() => true, () => false);
check("players appear live in host's lobby", lobbyCount);

// Start: everyone gets question 1
await olivia.getByRole("button", { name: "Start battle" }).click();
const q1 = await Promise.all([olivia, max, nina].map((p) => p.getByRole("heading", { name: "2 + 2 = ?" }).waitFor({ timeout: 5000 }).then(() => true, () => false)));
check("question appears for all players at once", q1.every(Boolean));
const stateDuring = await (await max.request.get(`${B}/api/battles/${battleId}/state`)).json();
check("answer not leaked during question", stateDuring.correctOptionId === null && stateDuring.answerCounts === null && stateDuring.explanation === null);
const secs = Number(await max.getByLabel("Seconds left").innerText());
check("countdown running (~20s)", secs >= 15 && secs <= 20, String(secs));

const answer = (p, text) => p.getByRole("group", { name: "Answers" }).getByRole("button", { name: text }).click();
await answer(max, "4");                          // fastest correct
await max.getByText("Answer locked in").waitFor();
const stateAfter = await (await max.request.get(`${B}/api/battles/${battleId}/state`)).json();
check("own answer hidden-correctness until reveal", stateAfter.myAnswer?.optionId && stateAfter.myAnswer.correct === undefined);
await olivia.waitForTimeout(1500);
await answer(olivia, "4");                       // slower correct
await answer(nina, "5");                         // wrong
const revealed = await max.getByText("Correct!").waitFor({ timeout: 5000 }).then(() => true, () => false);
check("auto-reveal once everyone answered", revealed);
const maxPts = Number((await max.getByText(/^\+\d+ points$/).innerText()).match(/\d+/)[0]);
check("speed bonus: fast correct answer > 900 pts", maxPts > 900 && maxPts <= 1000, String(maxPts));
check("wrong answer shown to Nina", await nina.getByText("Not this time").isVisible());
check("vote counts + explanation on reveal", (await nina.getByText("Basic addition.").isVisible()) && (await nina.getByLabel("Correct answer").count()) === 1);
check("only host can continue", (await max.getByRole("button", { name: /Next question/ }).count()) === 0 && (await olivia.getByRole("button", { name: "Next question" }).isVisible()));
const board = await olivia.getByLabel("Scoreboard").locator("li").allInnerTexts();
check("scoreboard ranks Max, Olivia, Nina", board[0]?.includes("Max") && board[1]?.includes("Olivia") && board[2]?.includes("Nina"), JSON.stringify(board.map((b) => b.replace(/\s+/g, " "))));

// Question 2: only Olivia answers; time runs out for the rest
await olivia.getByRole("button", { name: "Next question" }).click();
await max.getByRole("heading", { name: "Capital of France?" }).waitFor();
await answer(olivia, "Paris");
const timedOut = await max.getByText("Time's up!").waitFor({ timeout: 30000 }).then(() => true, () => false);
check("question closes when the timer runs out", timedOut);
const late = await max.request.get(`${B}/api/battles/${battleId}/state`).then((r) => r.json());
check("no answers accepted after reveal", late.status === "reveal");

// Finish
await olivia.getByRole("button", { name: "Show final results" }).click();
const podium = await Promise.all([olivia, max, nina].map((p) => p.getByRole("heading", { name: /wins!/ }).waitFor({ timeout: 5000 }).then(() => p.getByRole("heading", { name: /wins!/ }).innerText(), () => "")));
check("podium shown to everyone", podium.every((t) => t.length > 0), podium[0]);
const winner = podium[0].includes("Olivia") ? "Olivia" : podium[0].includes("Max") ? "Max" : "?";
check("winner has highest total", ["Olivia", "Max"].includes(winner), winner);

// XP + badge
const champ = winner === "Olivia" ? olivia : max;
await champ.goto(`${B}/dashboard`);
await champ.getByRole("link", { name: "Your profile" }).click();
await champ.waitForURL("**/u/**");
check("winner earns the Champion badge", (await champ.locator("li.bg-accent-soft", { hasText: "Champion" }).count()) === 1);
await nina.goto(cUrl);
check("finished battle leaves 'Live now'", (await nina.locator("aside").getByText("Live now").count()) === 0);

await max.setViewportSize({ width: 1280, height: 860 });
await browser.close();
summary();
