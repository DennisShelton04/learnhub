"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { battle, battleAnswer, battlePlayer } from "@/db/schema/battles";
import { requireUser } from "@/lib/session";
import { deadlineOf, getBattleAccess, getBattleQuestions, listPlayers, pointsFor } from "@/server/battles";
import { notifyBattleStarted } from "@/server/notifications";
import { getQuizAccess } from "@/server/quizzes";
import { battleTopic, publish } from "@/server/realtime";
import { awardXp } from "@/server/xp";

const GRACE_MS = 1000; // network latency allowance for answers near the deadline

const changed = (battleId: string) => publish({ topic: battleTopic(battleId), type: "battle.updated", id: battleId });

export async function createBattle(quizId: string) {
  const user = await requireUser();
  const access = await getQuizAccess(quizId, user.id);
  if (!access?.role) throw new Error("Join this community to host a battle.");
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(battle).values({ id, quizId, communityId: access.communityId, hostId: user.id });
    await tx.insert(battlePlayer).values({ battleId: id, userId: user.id });
  });
  await notifyBattleStarted(id);
  // The community sidebar lists live battles.
  revalidatePath(`/c/${access.slug}`, "layout");
  redirect(`/c/${access.slug}/b/${id}`);
}

export async function joinBattle(battleId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const access = await getBattleAccess(battleId, user.id);
  if (!access) return { error: "This battle no longer exists." };
  if (!access.role) return { error: "Join this community to play." };
  if (access.status === "finished") return { error: "This battle has finished." };
  await db.insert(battlePlayer).values({ battleId, userId: user.id }).onConflictDoNothing();
  await changed(battleId);
  return {};
}

/** Host moves the battle on: lobby → first question → reveal → next question … → finished. */
export async function advanceBattle(battleId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const b = await getBattleAccess(battleId, user.id);
  if (!b) return { error: "This battle no longer exists." };
  if (b.hostId !== user.id) return { error: "Only the host can do that." };
  const questions = await getBattleQuestions(b.quizId);

  // Each update is conditional on the state we read, so double clicks can't skip a step.
  const from = and(eq(battle.id, battleId), eq(battle.status, b.status), eq(battle.currentIndex, b.currentIndex));
  if (b.status === "lobby" || b.status === "reveal") {
    const nextIndex = b.currentIndex + 1;
    if (nextIndex < questions.length) {
      await db.update(battle).set({ status: "question", currentIndex: nextIndex, questionStartedAt: new Date() }).where(from);
    } else {
      const done = await db.update(battle).set({ status: "finished", finishedAt: new Date() }).where(from).returning({ id: battle.id });
      if (done.length) {
        await awardBattleXp(battleId, b.communityId);
        revalidatePath(`/c/${b.slug}`, "layout");
      }
    }
  } else if (b.status === "question") {
    await db.update(battle).set({ status: "reveal" }).where(from);
  }
  await changed(battleId);
  return {};
}

/** Any player may close a question whose time has run out (so it works even if the host is away). */
export async function expireQuestion(battleId: string) {
  const user = await requireUser();
  const b = await getBattleAccess(battleId, user.id);
  const deadline = b && deadlineOf(b);
  if (!b || b.status !== "question" || !deadline || Date.now() < deadline.getTime() + GRACE_MS) return;
  const done = await db
    .update(battle)
    .set({ status: "reveal" })
    .where(and(eq(battle.id, battleId), eq(battle.status, "question"), eq(battle.currentIndex, b.currentIndex)))
    .returning({ id: battle.id });
  if (done.length) await changed(battleId);
}

export async function answerBattle(battleId: string, optionId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const answeredAt = new Date();
  const b = await getBattleAccess(battleId, user.id);
  if (!b) return { error: "This battle no longer exists." };
  if (b.status !== "question" || !b.questionStartedAt) return { error: "Answers are closed." };
  const deadline = deadlineOf(b)!;
  if (answeredAt.getTime() > deadline.getTime() + GRACE_MS) return { error: "Time's up!" };

  const isPlayer = await db.query.battlePlayer.findFirst({
    where: and(eq(battlePlayer.battleId, battleId), eq(battlePlayer.userId, user.id)),
  });
  if (!isPlayer) return { error: "Join the battle to answer." };

  const question = (await getBattleQuestions(b.quizId))[b.currentIndex];
  const option = question?.options.find((o) => o.id === optionId);
  if (!question || !option) return { error: "That answer isn't part of this question." };

  const points = pointsFor(option.isCorrect, answeredAt, b.questionStartedAt, b.secondsPerQuestion);
  const inserted = await db
    .insert(battleAnswer)
    .values({ battleId, userId: user.id, questionId: question.id, optionId, correct: option.isCorrect, points, answeredAt })
    .onConflictDoNothing()
    .returning({ points: battleAnswer.points });
  if (inserted.length === 0) return { error: "You've already answered." };
  if (points > 0) {
    await db
      .update(battlePlayer)
      .set({ score: sql`${battlePlayer.score} + ${points}` })
      .where(and(eq(battlePlayer.battleId, battleId), eq(battlePlayer.userId, user.id)));
  }

  // Everyone has answered: reveal straight away.
  const [[answered], [players]] = await Promise.all([
    db.select({ n: count() }).from(battleAnswer).where(and(eq(battleAnswer.battleId, battleId), eq(battleAnswer.questionId, question.id))),
    db.select({ n: count() }).from(battlePlayer).where(eq(battlePlayer.battleId, battleId)),
  ]);
  if (answered.n >= players.n) {
    await db
      .update(battle)
      .set({ status: "reveal" })
      .where(and(eq(battle.id, battleId), eq(battle.status, "question"), eq(battle.currentIndex, b.currentIndex)));
  }
  await changed(battleId);
  return {};
}

async function awardBattleXp(battleId: string, communityId: string) {
  const players = await listPlayers(battleId);
  for (const p of players) await awardXp({ userId: p.userId, communityId, kind: "battle_played", refId: battleId });
  // Winner: top score, needs at least one other player and a non-zero score.
  const [top, second] = players;
  if (top && players.length > 1 && top.score > 0 && top.score > (second?.score ?? 0)) {
    await awardXp({ userId: top.userId, communityId, kind: "battle_won", refId: battleId });
  }
}
