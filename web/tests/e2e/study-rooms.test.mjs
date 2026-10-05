import { out } from "./helpers.mjs";
import { B, T, browser, check, createCommunity, join, newUser, summary } from "./helpers.mjs";

const olivia = await newUser("Olivia");
const cUrl = await createCommunity(olivia, `Room ${T}`);
await olivia.goto(`${cUrl}/new?type=video`);
await olivia.fill("input[name=url]", "https://www.youtube.com/watch?v=PkZNo7MFNFg");
await olivia.click("button[type=submit]");
await olivia.waitForURL("**/p/**", { timeout: 20000 });
const postUrl = olivia.url();
const postId = postUrl.split("/p/")[1];
await olivia.getByRole("link", { name: /Watch together/ }).click();
await olivia.waitForURL("**/room");
const roomUrl = olivia.url();
check("room page shows empty state", await olivia.getByText("Nobody is here yet").isVisible());

const max = await newUser("Max");
const nina = await newUser("Nina");
for (const p of [max, nina]) await join(p, cUrl);

// Nina listens to the room's event stream (without joining) and counts signals she receives.
await nina.goto(roomUrl);
await nina.evaluate((pid) => {
  window.__signals = 0;
  const es = new EventSource(`/api/rooms/${pid}/events`);
  es.addEventListener("room.signal", () => window.__signals++);
}, postId);

await olivia.getByRole("button", { name: "Join study room" }).click();
await olivia.getByRole("button", { name: "Leave" }).waitFor();
check("joining shows you in the room as host", (await olivia.locator('li[data-connection="self"]').getByLabel("Video host").count()) === 1);

await max.goto(roomUrl);
await max.getByRole("button", { name: "Join study room" }).click();
const connected = await Promise.all([
  olivia.locator(`li[data-connection="connected"]`, { hasText: "Max" }).waitFor({ timeout: 15000 }).then(() => true, () => false),
  max.locator(`li[data-connection="connected"]`, { hasText: "Olivia" }).waitFor({ timeout: 15000 }).then(() => true, () => false),
]);
check("peer-to-peer voice connects both ways", connected.every(Boolean));
await max.waitForTimeout(1500);
const audio = await max.evaluate(() => {
  const el = document.querySelector("audio[data-peer-audio]");
  const tracks = el?.srcObject?.getAudioTracks() ?? [];
  return { tracks: tracks.length, live: tracks[0]?.readyState, playing: el ? !el.paused : false };
});
check("Max receives Olivia's audio track and it's playing", audio.tracks === 1 && audio.live === "live" && audio.playing, JSON.stringify(audio));
check("other members never receive private WebRTC signals", (await nina.evaluate(() => window.__signals)) === 0);
check("Nina sees 2 people in the room", await nina.getByText("2 people here").waitFor({ timeout: 5000 }).then(() => true, () => false));

// Mute
await olivia.getByRole("button", { name: "Mute" }).click();
check("mute shows for others", await max.locator("li", { hasText: "Olivia" }).getByLabel("Muted").waitFor({ timeout: 5000 }).then(() => true, () => false));
await olivia.getByRole("button", { name: "Unmute" }).click();

// Sidebar live room
await nina.goto(cUrl);
check("sidebar shows the live room", await nina.locator("aside").getByRole("link", { name: /· 2 here/ }).isVisible());

// Video sync: host plays, follower follows; host pauses, follower pauses
const hostFrame = olivia.frameLocator("iframe");
const ytReady = await hostFrame.locator("video").waitFor({ timeout: 20000 }).then(() => true, () => false);
if (ytReady) {
  await olivia.waitForTimeout(1500);
  const clickPlayer = async () => {
    const box = await olivia.locator("iframe").boundingBox();
    await olivia.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  await clickPlayer();
  const hostPlaying = await olivia.locator('[data-player-state="1"]').waitFor({ timeout: 15000 }).then(() => true, () => false);
  const followerPlaying = await max.locator('[data-player-state="1"]').waitFor({ timeout: 15000 }).then(() => true, () => false);
  check("host plays → follower's video plays", hostPlaying && followerPlaying, `host=${hostPlaying} follower=${followerPlaying}`);
  await olivia.waitForTimeout(3000);
  await clickPlayer();
  const followerPaused = await max.locator('[data-player-state="2"]').waitFor({ timeout: 10000 }).then(() => true, () => false);
  check("host pauses → follower's video pauses", followerPaused);
} else {
  check("YouTube player loaded in test browser", false, "iframe video element not found");
}

// API guards
const outsider = await newUser("Outsider");
const sig = await outsider.request.post(`${B}/api/rooms/${postId}/signal`, { data: { to: "x", kind: "ice", payload: {} } });
check("non-member can't signal (403)", sig.status() === 403);
const notIn = await nina.request.post(`${B}/api/rooms/${postId}/signal`, { data: { to: "someone", kind: "ice", payload: {} } });
check("signalling requires being in the room (409)", notIn.status() === 409);
const pb = await max.request.post(`${B}/api/rooms/${postId}/playback`, { data: { playing: true, positionSec: 99 } });
check("only the host can control playback (403)", pb.status() === 403);

// Leave + host handover
await olivia.getByRole("button", { name: "Leave" }).click();
check("leaving updates others live", await max.getByText("1 person here").waitFor({ timeout: 5000 }).then(() => true, () => false));
check("host role passes to the next person", await max.locator('li[data-connection="self"]').getByLabel("Video host").waitFor({ timeout: 5000 }).then(() => true, () => false));
const pb2 = await max.request.post(`${B}/api/rooms/${postId}/playback`, { data: { playing: false, positionSec: 10 } });
check("new host can control playback", pb2.ok());

await max.setViewportSize({ width: 1400, height: 860 });
await max.screenshot({ path: out("room.png") });
await browser.close();
summary();
