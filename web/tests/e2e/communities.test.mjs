import { out } from "./helpers.mjs";
import { B, T, browser, check, emailFor, newPage, submitAuth, summary } from "./helpers.mjs";

async function signup(page, name, email) {
  await page.goto(`${B}/signup`);
  await page.fill('input[name=name]', name);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', "secret123");
  await submitAuth(page, "**/dashboard");
}
async function createCommunity(page, name, desc, visibility) {
  await page.goto(`${B}/communities/new`);
  await page.fill('input[name=name]', name);
  await page.fill('textarea[name=description]', desc);
  await page.check(`input[value=${visibility}]`);
  await page.click('button[type=submit]');
}
const memberRow = (page, name) => page.locator("main li", { hasText: name });

// 1. Owner signs up
const olivia = await newPage();
await signup(olivia, "Olivia", emailFor("olivia"));
await olivia.waitForURL("**/dashboard");
check("signup lands on dashboard with empty state", await olivia.getByText("haven't joined any communities").isVisible());

// 2. Validation error (bypass browser minlength to hit the server check)
await olivia.goto(`${B}/communities/new`);
await olivia.$eval('input[name=name]', (el) => el.removeAttribute("minlength"));
await olivia.fill('input[name=name]', "ab");
await olivia.click('button[type=submit]');
const alert = olivia.getByRole("alert").filter({ hasText: "at least 3" });
await alert.waitFor({ timeout: 5000 }).catch(() => {});
check("server rejects too-short name", await alert.isVisible());

// 3. Create public community
const pubName = `JavaScript Beginners ${T}`;
await createCommunity(olivia, pubName, "Learn JS together", "public");
await olivia.waitForURL("**/c/**");
const pubUrl = olivia.url();
const pubMembers = pubUrl + "/members";
check("create public community redirects to its page", await olivia.getByRole("heading", { name: pubName }).waitFor().then(() => true, () => false), pubUrl.replace(B, ""));
await olivia.goto(pubMembers);
check("creator is owner", await memberRow(olivia, "Olivia").getByText("owner").isVisible());
check("owner sees invite link", await olivia.getByLabel("Invite link").isVisible());

// 4. Duplicate name gets a unique slug
await createCommunity(olivia, pubName, "", "public");
await olivia.waitForURL("**/c/**");
check("duplicate name gets different slug", olivia.url() !== pubUrl, olivia.url().replace(B, ""));

// 5. Create private community
const privName = `Secret Study ${T}`;
await createCommunity(olivia, privName, "Invite only", "private");
await olivia.waitForURL("**/c/**");
const privUrl = olivia.url();
await olivia.goto(privUrl + "/members");
const inviteUrl = await olivia.getByLabel("Invite link").inputValue();
check("private community created with invite link", inviteUrl.includes("/join/"), inviteUrl.replace(B, ""));

// 6. Second user browses and searches
const max = await newPage();
await signup(max, "Max", emailFor("max"));
await max.waitForURL("**/dashboard");
await max.goto(`${B}/communities?q=${T}`);
check("search finds public community", await max.getByText(pubName).first().isVisible());
check("private community hidden from browse", (await max.getByText(privName).count()) === 0);
await max.goto(`${B}/communities?q=zzz-nothing-${T}`);
check("search with no match shows message", await max.getByText("No communities match").isVisible());

// 7. Non-member can't open private community
const res = await max.goto(privUrl);
check("private community returns 404 to non-member", res.status() === 404, `status ${res.status()}`);

// 8. Join public community
await max.goto(pubUrl);
await max.getByRole("button", { name: "Join community" }).first().click();
await max.getByRole("button", { name: "Leave" }).waitFor();
check("join shows Leave button and 2 members", await max.getByText("2 members").isVisible());
await max.goto(pubMembers);
check("member has no invite link", (await max.getByLabel("Invite link").count()) === 0);
check("member sees no Remove buttons", (await max.getByRole("button", { name: "Remove", exact: true }).count()) === 0);

// 9. Owner promotes member to moderator
await olivia.goto(pubMembers);
await memberRow(olivia, "Max").getByRole("button", { name: "Make moderator" }).click();
await memberRow(olivia, "Max").getByRole("button", { name: "Remove moderator" }).waitFor();
await max.reload();
check("member promoted to moderator", await memberRow(max, "Max").getByText("moderator").isVisible());
check("moderator cannot remove owner", (await memberRow(max, "Olivia").getByRole("button", { name: "Remove", exact: true }).count()) === 0);

// 10. Invite link flow for a logged-out user
const nina = await newPage();
await nina.goto(inviteUrl);
check("logged-out invite redirects to login with next", nina.url().includes("/login?next=%2Fjoin%2F"), nina.url().replace(B, ""));
await nina.getByRole("link", { name: "Create an account" }).click();
await nina.waitForURL("**/signup?next=**");
await nina.fill('input[name=name]', "Nina");
await nina.fill('input[name=email]', emailFor("nina"));
await nina.fill('input[name=password]', "secret123");
await submitAuth(nina, "**/join/**");
check("after signup, returns to invite page", await nina.getByText("You've been invited").isVisible());
await nina.getByRole("button", { name: "Join community" }).first().click();
await nina.waitForURL(privUrl);
check("joining by invite opens the private community", await nina.getByRole("heading", { name: privName }).isVisible());

// 11. Moderator removes a plain member (Nina joins public first)
await nina.goto(pubUrl);
await nina.getByRole("button", { name: "Join community" }).first().click();
await nina.getByRole("button", { name: "Leave" }).waitFor();
await max.goto(pubMembers);
await memberRow(max, "Nina").getByRole("button", { name: "Remove", exact: true }).click();
await memberRow(max, "Nina").waitFor({ state: "detached" });
check("moderator removed a member", (await memberRow(max, "Nina").count()) === 0);

// 12. Leave
await nina.goto(privUrl);
await nina.getByRole("button", { name: "Leave" }).click();
await nina.waitForURL("**/communities");
const after = await nina.goto(privUrl);
check("after leaving private community it 404s", after.status() === 404);

// 13. Owner removes moderator; dashboard lists memberships
await olivia.goto(pubMembers);
await memberRow(olivia, "Max").getByRole("button", { name: "Remove", exact: true }).click();
await memberRow(olivia, "Max").waitFor({ state: "detached" });
check("owner removed moderator", (await memberRow(olivia, "Max").count()) === 0);
await olivia.goto(`${B}/dashboard`);
check("dashboard lists owner's 3 communities", (await olivia.locator('main a[href^="/c/"]').count()) === 3);

// Screenshots
await olivia.goto(pubMembers);
await olivia.setViewportSize({ width: 1100, height: 700 });
await olivia.screenshot({ path: out("community-desktop.png") });
await olivia.setViewportSize({ width: 390, height: 800 });
await olivia.goto(`${B}/communities`);
await olivia.screenshot({ path: out("communities-mobile.png") });

await browser.close();
summary();
