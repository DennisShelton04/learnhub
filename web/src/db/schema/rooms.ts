import { boolean, index, pgTable, primaryKey, real, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { post } from "./posts";

/** Who is in a post's study room right now (kept fresh by heartbeats). */
export const roomParticipant = pgTable(
  "room_participant",
  {
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    muted: boolean("muted").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] }), index("room_participant_seen_idx").on(t.lastSeenAt)],
);

/** Shared video playback position for a post's study room. */
export const roomPlayback = pgTable("room_playback", {
  postId: text("post_id")
    .primaryKey()
    .references(() => post.id, { onDelete: "cascade" }),
  playing: boolean("playing").notNull().default(false),
  positionSec: real("position_sec").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
