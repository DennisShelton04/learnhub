import { and, asc, count, desc, eq, gt, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { battle, battleAnswer, battlePlayer } from "@/db/schema/battles";
import { community } from "@/db/schema/communities";
import { quiz, quizOption, quizQuestion } from "@/db/schema/quizzes";
import { getMembership } from "@/server/communities";

export const MAX_POINTS = 1000;

/** Correct answers earn 500 plus up to 500 more for speed. */
export function pointsFor(correct: boolean, answeredAt: Date, startedAt: Date, seconds: number) {
  if (!correct) return 0;
  const remaining = Math.max(0, seconds * 1000 - (answeredAt.getTime() - startedAt.getTime()));
  return 500 + Math.round((500 * remaining) / (seconds * 1000));
}

export function deadlineOf(b: { questionStartedAt: Date | null; secondsPerQuestion: number }) {
  return b.questionStartedAt ? new Date(b.questionStartedAt.getTime() + b.secondsPerQuestion * 1000) : null;
}

/** The battle plus the viewer's role, or null if missing or private to them. */
export async function getBattleAccess(battleId: string, userId: string) {
  const [row] = await db
    .select({ battle, slug: community.slug, visibility: community.visibility })
    .from(battle)
    .innerJoin(community, eq(community.id, battle.communityId))
    .where(eq(battle.id, battleId));
  if (!row) return null;
  const membership = await getMembership(row.battle.communityId, userId);
  if (row.visibility === "private" && !membership) return null;
  return { ...row.battle, slug: row.slug, role: membership?.role };
}

export async function getBattleQuestions(quizId: string) {
  return db.query.quizQuestion.findMany({
    where: eq(quizQuestion.quizId, quizId),
    orderBy: asc(quizQuestion.position),
    with: { options: { orderBy: asc(quizOption.position) } },
  });
}

export async function listPlayers(battleId: string) {
  return db
    .select({ userId: battlePlayer.userId, name: user.name, score: battlePlayer.score })
    .from(battlePlayer)
    .innerJoin(user, eq(user.id, battlePlayer.userId))
    .where(eq(battlePlayer.battleId, battleId))
    .orderBy(desc(battlePlayer.score), asc(battlePlayer.joinedAt));
}

export type BattleState = {
  id: string;
  quizId: string;
  quizTitle: string;
  status: "lobby" | "question" | "reveal" | "finished";
  index: number;
  total: number;
  secondsPerQuestion: number;
  serverNow: string;
  deadline: string | null;
  question: { id: string; prompt: string; options: { id: string; text: string }[] } | null;
  /** The viewer's answer to the current question. Correctness is only included once revealed. */
  myAnswer: { optionId: string; correct?: boolean; points?: number } | null;
  correctOptionId: string | null;
  explanation: string | null;
  answerCounts: Record<string, number> | null;
  answeredCount: number;
  players: { userId: string; name: string; score: number }[];
  hostId: string;
  isHost: boolean;
  isPlayer: boolean;
  canJoin: boolean;
};

/** Everything one viewer needs to render the battle. Never leaks the answer before the reveal. */
export async function getBattleState(battleId: string, userId: string): Promise<BattleState | null> {
  const access = await getBattleAccess(battleId, userId);
  if (!access) return null;
  const [questions, players, quizRow] = await Promise.all([
    getBattleQuestions(access.quizId),
    listPlayers(battleId),
    db.query.quiz.findFirst({ where: eq(quiz.id, access.quizId), columns: { title: true } }),
  ]);

  const revealed = access.status === "reveal" || access.status === "finished";
  const current = access.currentIndex >= 0 ? questions[access.currentIndex] : undefined;
  const showQuestion = current && access.status !== "lobby" && !(access.status === "finished" && access.currentIndex < 0);

  let myAnswer: BattleState["myAnswer"] = null;
  let answerCounts: BattleState["answerCounts"] = null;
  let answeredCount = 0;
  if (current) {
    const answers = await db
      .select({ userId: battleAnswer.userId, optionId: battleAnswer.optionId, correct: battleAnswer.correct, points: battleAnswer.points })
      .from(battleAnswer)
      .where(and(eq(battleAnswer.battleId, battleId), eq(battleAnswer.questionId, current.id)));
    answeredCount = answers.length;
    const mine = answers.find((a) => a.userId === userId);
    if (mine) myAnswer = revealed ? mine : { optionId: mine.optionId };
    if (revealed) {
      answerCounts = Object.fromEntries(current.options.map((o) => [o.id, answers.filter((a) => a.optionId === o.id).length]));
    }
  }

  const isPlayer = players.some((p) => p.userId === userId);
  return {
    id: access.id,
    quizId: access.quizId,
    quizTitle: quizRow?.title ?? "Quiz",
    status: access.status,
    index: access.currentIndex,
    total: questions.length,
    secondsPerQuestion: access.secondsPerQuestion,
    serverNow: new Date().toISOString(),
    deadline: access.status === "question" ? (deadlineOf(access)?.toISOString() ?? null) : null,
    question: showQuestion ? { id: current.id, prompt: current.prompt, options: current.options.map(({ id, text }) => ({ id, text })) } : null,
    myAnswer,
    correctOptionId: revealed && current ? (current.options.find((o) => o.isCorrect)?.id ?? null) : null,
    explanation: revealed && current ? current.explanation : null,
    answerCounts,
    answeredCount,
    players,
    hostId: access.hostId,
    isHost: access.hostId === userId,
    isPlayer,
    canJoin: !isPlayer && Boolean(access.role) && access.status !== "finished",
  };
}

/** Battles still running in a community (ignores lobbies abandoned for hours). */
export const listLiveBattles = cache(async (communityId: string) => {
  return db
    .select({ id: battle.id, quizTitle: quiz.title, status: battle.status, players: count(battlePlayer.userId) })
    .from(battle)
    .innerJoin(quiz, eq(quiz.id, battle.quizId))
    .leftJoin(battlePlayer, eq(battlePlayer.battleId, battle.id))
    .where(and(eq(battle.communityId, communityId), ne(battle.status, "finished"), gt(battle.createdAt, sql`now() - interval '3 hours'`)))
    .groupBy(battle.id, quiz.title)
    .orderBy(desc(battle.createdAt));
});
