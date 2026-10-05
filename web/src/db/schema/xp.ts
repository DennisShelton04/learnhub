import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { community } from "./communities";

export const xpKind = pgEnum("xp_kind", [
  "post_shared",
  "message_sent",
  "voice_sent",
  "quiz_created",
  "quiz_completed",
  "quiz_perfect",
  "battle_played",
  "battle_won",
]);

/** One row per XP award. The (user, kind, ref) unique key makes awards idempotent. */
export const xpEvent = pgTable(
  "xp_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    communityId: text("community_id").references(() => community.id, { onDelete: "set null" }),
    kind: xpKind("kind").notNull(),
    // What earned it (post id, message id, quiz id…).
    refId: text("ref_id").notNull(),
    points: integer("points").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("xp_event_unique_idx").on(t.userId, t.kind, t.refId),
    index("xp_event_user_idx").on(t.userId, t.createdAt),
    index("xp_event_community_idx").on(t.communityId, t.createdAt),
  ],
);
