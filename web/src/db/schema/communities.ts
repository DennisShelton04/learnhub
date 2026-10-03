import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const communityVisibility = pgEnum("community_visibility", ["public", "private"]);
export const memberRole = pgEnum("member_role", ["owner", "moderator", "member"]);

export const community = pgTable("community", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  visibility: communityVisibility("visibility").notNull().default("public"),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const communityMember = pgTable(
  "community_member",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => community.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.communityId, table.userId] }),
    index("community_member_userId_idx").on(table.userId),
  ],
);

export const communityRelations = relations(community, ({ many, one }) => ({
  members: many(communityMember),
  creator: one(user, { fields: [community.createdBy], references: [user.id] }),
}));

export const communityMemberRelations = relations(communityMember, ({ one }) => ({
  community: one(community, { fields: [communityMember.communityId], references: [community.id] }),
  user: one(user, { fields: [communityMember.userId], references: [user.id] }),
}));
