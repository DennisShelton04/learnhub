import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { community } from "./communities";

export const postType = pgEnum("post_type", ["video", "article", "note"]);

export const post = pgTable(
  "post",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    communityId: text("community_id")
      .notNull()
      .references(() => community.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: postType("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    url: text("url"),
    // YouTube video id for video posts.
    videoId: text("video_id"),
    // Link preview fetched when the post is created.
    previewTitle: text("preview_title"),
    previewDescription: text("preview_description"),
    previewImage: text("preview_image"),
    previewSiteName: text("preview_site_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("post_community_created_idx").on(table.communityId, table.createdAt)],
);

export const postRelations = relations(post, ({ one }) => ({
  community: one(community, { fields: [post.communityId], references: [community.id] }),
  author: one(user, { fields: [post.authorId], references: [user.id] }),
}));
