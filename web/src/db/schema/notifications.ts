import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const notificationKind = pgEnum("notification_kind", ["reply", "post_comment", "battle_started"]);

export const notification = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    // Groups related notifications (e.g. comments on one post) so they don't pile up.
    groupKey: text("group_key").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt), index("notification_group_idx").on(t.userId, t.groupKey)],
);
