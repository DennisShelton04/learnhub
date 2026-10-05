import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { community } from "./communities";
import { post } from "./posts";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const quiz = pgTable(
  "quiz",
  {
    id: id(),
    communityId: text("community_id")
      .notNull()
      .references(() => community.id, { onDelete: "cascade" }),
    // Optional: the post this quiz tests.
    postId: text("post_id").references(() => post.id, { onDelete: "set null" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("quiz_community_idx").on(t.communityId, t.createdAt)],
);

export const quizQuestion = pgTable(
  "quiz_question",
  {
    id: id(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quiz.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    prompt: text("prompt").notNull(),
    explanation: text("explanation").notNull().default(""),
  },
  (t) => [uniqueIndex("quiz_question_position_idx").on(t.quizId, t.position)],
);

export const quizOption = pgTable(
  "quiz_option",
  {
    id: id(),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
  },
  (t) => [uniqueIndex("quiz_option_position_idx").on(t.questionId, t.position)],
);

export const quizAttempt = pgTable(
  "quiz_attempt",
  {
    id: id(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quiz.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: integer("score").notNull().default(0),
    total: integer("total").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("quiz_attempt_quiz_idx").on(t.quizId), index("quiz_attempt_user_idx").on(t.userId)],
);

export const quizAnswer = pgTable(
  "quiz_answer",
  {
    attemptId: text("attempt_id")
      .notNull()
      .references(() => quizAttempt.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    optionId: text("option_id")
      .notNull()
      .references(() => quizOption.id, { onDelete: "cascade" }),
    correct: boolean("correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // One answer per question per attempt.
  (t) => [uniqueIndex("quiz_answer_unique_idx").on(t.attemptId, t.questionId)],
);

export const quizRelations = relations(quiz, ({ many, one }) => ({
  questions: many(quizQuestion),
  author: one(user, { fields: [quiz.authorId], references: [user.id] }),
  post: one(post, { fields: [quiz.postId], references: [post.id] }),
}));

export const quizQuestionRelations = relations(quizQuestion, ({ many, one }) => ({
  quiz: one(quiz, { fields: [quizQuestion.quizId], references: [quiz.id] }),
  options: many(quizOption),
}));

export const quizOptionRelations = relations(quizOption, ({ one }) => ({
  question: one(quizQuestion, { fields: [quizOption.questionId], references: [quizQuestion.id] }),
}));
