"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { post } from "@/db/schema/posts";
import { quiz, quizAnswer, quizAttempt, quizOption, quizQuestion } from "@/db/schema/quizzes";
import { requireUser } from "@/lib/session";
import { getCommunityBySlug, getMembership } from "@/server/communities";
import { canDeleteQuiz, getPlayableQuestions, getQuizAccess, type PlayableQuestion } from "@/server/quizzes";
import { awardXp } from "@/server/xp";

const quizSchema = z.object({
  title: z.string().trim().min(3, "Give your quiz a title (at least 3 characters).").max(120, "Title must be 120 characters or less."),
  description: z.string().trim().max(500, "Description must be 500 characters or less."),
  postId: z.string().nullable(),
  questions: z
    .array(
      z
        .object({
          prompt: z.string().trim().min(1, "Every question needs some text.").max(500, "Questions can be up to 500 characters."),
          explanation: z.string().trim().max(1000, "Explanations can be up to 1000 characters."),
          options: z
            .array(z.string().trim().min(1, "Answer options can't be empty.").max(200, "Answer options can be up to 200 characters."))
            .min(2, "Each question needs at least 2 answers.")
            .max(6, "Each question can have at most 6 answers."),
          correctIndex: z.number().int().min(0),
        })
        .refine((q) => q.correctIndex < q.options.length, "Pick the correct answer for every question."),
    )
    .min(1, "Add at least one question.")
    .max(50, "A quiz can have at most 50 questions."),
});

export type QuizDraft = z.input<typeof quizSchema>;
export type CreateQuizState = { error?: string };

export async function createQuiz(communitySlug: string, draft: QuizDraft): Promise<CreateQuizState> {
  const user = await requireUser();
  const target = await getCommunityBySlug(communitySlug);
  if (!target) notFound();
  if (!(await getMembership(target.id, user.id))) return { error: "Join this community to create quizzes." };

  const parsed = quizSchema.safeParse(draft);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const qIndex = issue.path[0] === "questions" && typeof issue.path[1] === "number" ? issue.path[1] : null;
    return { error: qIndex !== null ? `Question ${qIndex + 1}: ${issue.message}` : issue.message };
  }
  const data = parsed.data;

  if (data.postId) {
    const linked = await db.query.post.findFirst({ where: and(eq(post.id, data.postId), eq(post.communityId, target.id)) });
    if (!linked) return { error: "The linked post wasn't found in this community." };
  }

  const quizId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(quiz).values({
      id: quizId,
      communityId: target.id,
      postId: data.postId,
      authorId: user.id,
      title: data.title,
      description: data.description,
    });
    for (const [position, q] of data.questions.entries()) {
      const questionId = crypto.randomUUID();
      await tx.insert(quizQuestion).values({ id: questionId, quizId, position, prompt: q.prompt, explanation: q.explanation });
      await tx.insert(quizOption).values(
        q.options.map((text, i) => ({ questionId, position: i, text, isCorrect: i === q.correctIndex })),
      );
    }
  });

  await awardXp({ userId: user.id, communityId: target.id, kind: "quiz_created", refId: quizId });
  revalidatePath(`/c/${communitySlug}`, "layout");
  redirect(`/c/${communitySlug}/q/${quizId}`);
}

export async function deleteQuiz(quizId: string) {
  const user = await requireUser();
  const access = await getQuizAccess(quizId, user.id);
  if (!access) notFound();
  if (!canDeleteQuiz(access.role, access.authorId, user.id)) throw new Error("You don't have permission to delete this quiz.");
  await db.delete(quiz).where(eq(quiz.id, quizId));
  revalidatePath(`/c/${access.slug}`, "layout");
  redirect(`/c/${access.slug}`);
}

export type StartAttemptResult = { attemptId: string; questions: PlayableQuestion[] } | { error: string };

export async function startAttempt(quizId: string): Promise<StartAttemptResult> {
  const user = await requireUser();
  const access = await getQuizAccess(quizId, user.id);
  if (!access) return { error: "This quiz no longer exists." };
  if (!access.role) return { error: "Join this community to take its quizzes." };

  const questions = await getPlayableQuestions(quizId);
  const [attempt] = await db
    .insert(quizAttempt)
    .values({ quizId, userId: user.id, total: questions.length })
    .returning({ id: quizAttempt.id });
  return { attemptId: attempt.id, questions };
}

export type AnswerResult = { correct: boolean; correctOptionId: string; explanation: string } | { error: string };

/** Records one answer and reveals whether it was right. Each question can be answered once per attempt. */
export async function answerQuestion(attemptId: string, questionId: string, optionId: string): Promise<AnswerResult> {
  const user = await requireUser();
  const attempt = await db.query.quizAttempt.findFirst({ where: eq(quizAttempt.id, attemptId) });
  if (!attempt || attempt.userId !== user.id) return { error: "Attempt not found." };
  if (attempt.completedAt) return { error: "This attempt is already finished." };

  const question = await db.query.quizQuestion.findFirst({
    where: and(eq(quizQuestion.id, questionId), eq(quizQuestion.quizId, attempt.quizId)),
    with: { options: true },
  });
  const chosen = question?.options.find((o) => o.id === optionId);
  if (!question || !chosen) return { error: "That answer isn't part of this quiz." };
  const correctOption = question.options.find((o) => o.isCorrect)!;

  const inserted = await db
    .insert(quizAnswer)
    .values({ attemptId, questionId, optionId, correct: chosen.isCorrect })
    .onConflictDoNothing()
    .returning({ correct: quizAnswer.correct });
  if (inserted.length === 0) return { error: "You've already answered this question." };

  return { correct: chosen.isCorrect, correctOptionId: correctOption.id, explanation: question.explanation };
}

export type FinishResult = { score: number; total: number; xpEarned: number } | { error: string };

export async function finishAttempt(attemptId: string): Promise<FinishResult> {
  const user = await requireUser();
  const attempt = await db.query.quizAttempt.findFirst({ where: eq(quizAttempt.id, attemptId) });
  if (!attempt || attempt.userId !== user.id) return { error: "Attempt not found." };
  if (attempt.completedAt) return { score: attempt.score, total: attempt.total, xpEarned: 0 };

  const answers = await db.query.quizAnswer.findMany({ where: eq(quizAnswer.attemptId, attemptId), columns: { correct: true } });
  const score = answers.filter((a) => a.correct).length;
  await db.update(quizAttempt).set({ score, completedAt: new Date() }).where(eq(quizAttempt.id, attemptId));

  const access = await getQuizAccess(attempt.quizId, user.id);
  let xpEarned = 0;
  if (access) {
    // XP only for the first completion of each quiz, so retakes can't be farmed.
    const xpBase = { userId: user.id, communityId: access.communityId, refId: attempt.quizId };
    xpEarned += await awardXp({ ...xpBase, kind: "quiz_completed", bonus: 2 * score });
    if (attempt.total > 0 && score === attempt.total) xpEarned += await awardXp({ ...xpBase, kind: "quiz_perfect" });
    revalidatePath(`/c/${access.slug}/q/${attempt.quizId}`);
  }
  return { score, total: attempt.total, xpEarned };
}
