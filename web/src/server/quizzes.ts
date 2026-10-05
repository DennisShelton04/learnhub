import { and, asc, count, countDistinct, desc, eq, isNotNull, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { community } from "@/db/schema/communities";
import { post } from "@/db/schema/posts";
import { quiz, quizAttempt, quizOption, quizQuestion } from "@/db/schema/quizzes";
import { getMembership, type MemberRole } from "@/server/communities";

// Table-qualified on purpose: in single-table queries Drizzle leaves columns unqualified,
// which would make "quiz_id = id" compare two quiz_question columns inside the subquery.
const questionCount = sql<number>`(select count(*) from ${quizQuestion} where ${quizQuestion}.quiz_id = ${quiz}.id)`.mapWith(Number);

export const listCommunityQuizzes = cache(async (communityId: string) => {
  return db
    .select({ id: quiz.id, title: quiz.title, postId: quiz.postId, questionCount })
    .from(quiz)
    .where(eq(quiz.communityId, communityId))
    .orderBy(desc(quiz.createdAt))
    .limit(100);
});

export async function listPostQuizzes(postId: string) {
  return db.select({ id: quiz.id, title: quiz.title, questionCount }).from(quiz).where(eq(quiz.postId, postId)).orderBy(desc(quiz.createdAt));
}

export async function getQuiz(quizId: string) {
  const [row] = await db
    .select({
      id: quiz.id,
      communityId: quiz.communityId,
      authorId: quiz.authorId,
      authorName: user.name,
      title: quiz.title,
      description: quiz.description,
      postId: quiz.postId,
      postTitle: post.title,
      createdAt: quiz.createdAt,
      questionCount,
    })
    .from(quiz)
    .innerJoin(user, eq(user.id, quiz.authorId))
    .leftJoin(post, eq(post.id, quiz.postId))
    .where(eq(quiz.id, quizId));
  return row;
}

/** The quiz plus the viewer's role, or null if missing or private to them. */
export async function getQuizAccess(quizId: string, userId: string) {
  const [row] = await db
    .select({ quizId: quiz.id, authorId: quiz.authorId, communityId: community.id, slug: community.slug, visibility: community.visibility })
    .from(quiz)
    .innerJoin(community, eq(community.id, quiz.communityId))
    .where(eq(quiz.id, quizId));
  if (!row) return null;
  const membership = await getMembership(row.communityId, userId);
  if (row.visibility === "private" && !membership) return null;
  return { ...row, role: membership?.role };
}

export type PlayableQuestion = { id: string; prompt: string; options: { id: string; text: string }[] };

/** Questions and options for taking the quiz. Never includes which option is correct. */
export async function getPlayableQuestions(quizId: string): Promise<PlayableQuestion[]> {
  const questions = await db.query.quizQuestion.findMany({
    where: eq(quizQuestion.quizId, quizId),
    orderBy: asc(quizQuestion.position),
    columns: { id: true, prompt: true },
    with: { options: { orderBy: asc(quizOption.position), columns: { id: true, text: true } } },
  });
  return questions;
}

/** Each person's best completed attempt: highest score, then fastest. */
export async function getLeaderboard(quizId: string, limit = 20) {
  const duration = sql<number>`extract(epoch from (${quizAttempt.completedAt} - ${quizAttempt.startedAt}))`;
  const best = db
    .selectDistinctOn([quizAttempt.userId], {
      userId: quizAttempt.userId,
      score: quizAttempt.score,
      total: quizAttempt.total,
      seconds: duration.as("seconds"),
    })
    .from(quizAttempt)
    .where(and(eq(quizAttempt.quizId, quizId), isNotNull(quizAttempt.completedAt)))
    .orderBy(quizAttempt.userId, desc(quizAttempt.score), asc(duration))
    .as("best");

  return db
    .select({ userId: best.userId, name: user.name, score: best.score, total: best.total, seconds: best.seconds })
    .from(best)
    .innerJoin(user, eq(user.id, best.userId))
    .orderBy(desc(best.score), asc(best.seconds))
    .limit(limit)
    .then((rows) => rows.map((r) => ({ ...r, seconds: Math.round(Number(r.seconds)) })));
}

export async function getQuizStats(quizId: string) {
  const [row] = await db
    .select({ attempts: count(), players: countDistinct(quizAttempt.userId) })
    .from(quizAttempt)
    .where(and(eq(quizAttempt.quizId, quizId), isNotNull(quizAttempt.completedAt)));
  return row;
}

export function canDeleteQuiz(role: MemberRole | undefined, authorId: string, userId: string) {
  return authorId === userId || role === "owner" || role === "moderator";
}
