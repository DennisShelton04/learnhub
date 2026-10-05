import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { xpEvent, xpKind } from "@/db/schema/xp";

export type XpKind = (typeof xpKind.enumValues)[number];

/** Points per activity, and how many awards of each kind count per day (anti-farming). */
const rules: Record<XpKind, { points: number; dailyCap: number }> = {
  post_shared: { points: 10, dailyCap: 5 },
  message_sent: { points: 2, dailyCap: 25 },
  voice_sent: { points: 3, dailyCap: 10 },
  quiz_created: { points: 15, dailyCap: 3 },
  quiz_completed: { points: 5, dailyCap: 20 },
  quiz_perfect: { points: 10, dailyCap: 20 },
  battle_played: { points: 5, dailyCap: 10 },
  battle_won: { points: 20, dailyCap: 5 },
};

/**
 * Awards XP once per (user, kind, ref), within the daily cap for that kind.
 * `bonus` adds activity-specific points (e.g. +2 per correct quiz answer). Never throws:
 * XP is a side effect and must not break the action that earned it.
 */
export async function awardXp(opts: { userId: string; communityId: string | null; kind: XpKind; refId: string; bonus?: number }) {
  try {
    const rule = rules[opts.kind];
    const [today] = await db
      .select({ n: count() })
      .from(xpEvent)
      .where(and(eq(xpEvent.userId, opts.userId), eq(xpEvent.kind, opts.kind), gte(xpEvent.createdAt, sql`date_trunc('day', now())`)));
    if (today.n >= rule.dailyCap) return 0;

    const points = rule.points + (opts.bonus ?? 0);
    const inserted = await db
      .insert(xpEvent)
      .values({ userId: opts.userId, communityId: opts.communityId, kind: opts.kind, refId: opts.refId, points })
      .onConflictDoNothing()
      .returning({ points: xpEvent.points });
    return inserted[0]?.points ?? 0;
  } catch (err) {
    console.error("awardXp failed", err);
    return 0;
  }
}

// Level n starts at 50·(n−1)² XP: 0, 50, 200, 450, 800, 1250…
export function levelFor(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const start = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, progress: (xp - start) / (next - start), toNext: next - xp };
}

/** Current and longest run of consecutive active days (UTC days). */
function streaks(days: string[]) {
  const set = new Set(days);
  const dayMs = 86_400_000;
  const key = (t: number) => new Date(t).toISOString().slice(0, 10);
  const now = Date.now();
  // Today counts if active; otherwise the streak is still alive if yesterday was.
  let cursor = set.has(key(now)) ? now : now - dayMs;
  let current = 0;
  while (set.has(key(cursor))) {
    current++;
    cursor -= dayMs;
  }
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of [...days].sort()) {
    const t = Date.parse(d);
    run = prev !== null && t - prev === dayMs ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  return { current, longest };
}

export type Badge = { id: string; name: string; description: string; emoji: string; earned: boolean };

export const getUserStats = cache(async (userId: string) => {
  const [totals, days] = await Promise.all([
    db
      .select({ kind: xpEvent.kind, n: count(), points: sum(xpEvent.points).mapWith(Number) })
      .from(xpEvent)
      .where(eq(xpEvent.userId, userId))
      .groupBy(xpEvent.kind),
    db
      .selectDistinct({ day: sql<string>`to_char(${xpEvent.createdAt} at time zone 'UTC', 'YYYY-MM-DD')` })
      .from(xpEvent)
      .where(eq(xpEvent.userId, userId)),
  ]);
  const byKind = Object.fromEntries(totals.map((t) => [t.kind, t.n])) as Partial<Record<XpKind, number>>;
  const xp = totals.reduce((acc, t) => acc + (t.points ?? 0), 0);
  const level = levelFor(xp);
  const streak = streaks(days.map((d) => d.day));
  const n = (k: XpKind) => byKind[k] ?? 0;

  const badges: Badge[] = [
    { id: "first-share", emoji: "🌱", name: "First share", description: "Share your first post", earned: n("post_shared") >= 1 },
    { id: "chatterbox", emoji: "💬", name: "Chatterbox", description: "Send 50 messages", earned: n("message_sent") >= 50 },
    { id: "voice", emoji: "🎙️", name: "Voice of reason", description: "Send 10 voice notes", earned: n("voice_sent") >= 10 },
    { id: "quiz-maker", emoji: "🧩", name: "Quiz maker", description: "Create a quiz", earned: n("quiz_created") >= 1 },
    { id: "quiz-whiz", emoji: "🧠", name: "Quiz whiz", description: "Complete 10 different quizzes", earned: n("quiz_completed") >= 10 },
    { id: "perfectionist", emoji: "💯", name: "Perfectionist", description: "Get a perfect quiz score", earned: n("quiz_perfect") >= 1 },
    { id: "champion", emoji: "🏆", name: "Champion", description: "Win a live quiz battle", earned: n("battle_won") >= 1 },
    { id: "on-fire", emoji: "🔥", name: "On fire", description: "Learn 7 days in a row", earned: streak.longest >= 7 },
    { id: "scholar", emoji: "🎓", name: "Scholar", description: "Reach level 5", earned: level.level >= 5 },
  ];

  return { xp, ...level, streak, badges, counts: byKind };
});

/** Top members of a community by XP earned there, this week or all time. */
export async function getCommunityLeaderboard(communityId: string, period: "week" | "all", limit = 25) {
  const points = sum(xpEvent.points).mapWith(Number);
  return db
    .select({ userId: xpEvent.userId, name: user.name, xp: points })
    .from(xpEvent)
    .innerJoin(user, eq(user.id, xpEvent.userId))
    .where(
      and(
        eq(xpEvent.communityId, communityId),
        period === "week" ? gte(xpEvent.createdAt, sql`now() - interval '7 days'`) : undefined,
      ),
    )
    .groupBy(xpEvent.userId, user.name)
    .orderBy(desc(points))
    .limit(limit);
}
