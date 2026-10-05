import { relations } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { community } from "./communities";
import { quiz, quizOption, quizQuestion } from "./quizzes";

export const battleStatus = pgEnum("battle_status", ["lobby", "question", "reveal", "finished"]);

/** A live, timed run of a quiz that members play together. */
export const battle = pgTable(
  "battle",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quiz.id, { onDelete: "cascade" }),
    communityId: text("community_id")
      .notNull()
      .references(() => community.id, { onDelete: "cascade" }),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: battleStatus("status").notNull().default("lobby"),
    currentIndex: integer("current_index").notNull().default(-1),
    secondsPerQuestion: integer("seconds_per_question").notNull().default(20),
    questionStartedAt: timestamp("question_started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("battle_community_idx").on(t.communityId, t.status)],
);

export const battlePlayer = pgTable(
  "battle_player",
  {
    battleId: text("battle_id")
      .notNull()
      .references(() => battle.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: integer("score").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.battleId, t.userId] })],
);

export const battleAnswer = pgTable(
  "battle_answer",
  {
    battleId: text("battle_id")
      .notNull()
      .references(() => battle.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    optionId: text("option_id")
      .notNull()
      .references(() => quizOption.id, { onDelete: "cascade" }),
    correct: boolean("correct").notNull(),
    points: integer("points").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // One answer per player per question.
  (t) => [primaryKey({ columns: [t.battleId, t.userId, t.questionId] })],
);

export const battleRelations = relations(battle, ({ one, many }) => ({
  quiz: one(quiz, { fields: [battle.quizId], references: [quiz.id] }),
  players: many(battlePlayer),
}));

export const battlePlayerRelations = relations(battlePlayer, ({ one }) => ({
  battle: one(battle, { fields: [battlePlayer.battleId], references: [battle.id] }),
  user: one(user, { fields: [battlePlayer.userId], references: [user.id] }),
}));
