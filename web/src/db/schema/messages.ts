import { relations } from "drizzle-orm";
import { type AnyPgColumn, index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { post } from "./posts";

export const messageKind = pgEnum("message_kind", ["text", "voice"]);

export const message = pgTable(
  "message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The message this one replies to (shown as a reference above it).
    parentId: text("parent_id").references((): AnyPgColumn => message.id, { onDelete: "cascade" }),
    kind: messageKind("kind").notNull().default("text"),
    body: text("body").notNull(),
    // Voice notes: storage key of the audio file, its MIME type and length.
    audioKey: text("audio_key"),
    audioType: text("audio_type"),
    audioDurationMs: integer("audio_duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Soft delete keeps reply threads intact.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("message_post_created_idx").on(table.postId, table.createdAt)],
);

export const messageRelations = relations(message, ({ one }) => ({
  post: one(post, { fields: [message.postId], references: [post.id] }),
  author: one(user, { fields: [message.authorId], references: [user.id] }),
}));
