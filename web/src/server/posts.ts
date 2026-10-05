import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { community } from "@/db/schema/communities";
import { message } from "@/db/schema/messages";
import { post } from "@/db/schema/posts";
import { getMembership, type MemberRole } from "@/server/communities";

const postWithAuthor = {
  id: post.id,
  communityId: post.communityId,
  authorId: post.authorId,
  authorName: user.name,
  type: post.type,
  title: post.title,
  body: post.body,
  url: post.url,
  videoId: post.videoId,
  previewTitle: post.previewTitle,
  previewDescription: post.previewDescription,
  previewImage: post.previewImage,
  previewSiteName: post.previewSiteName,
  createdAt: post.createdAt,
};

export type PostWithAuthor = Awaited<ReturnType<typeof listCommunityPosts>>[number];

// Table-qualified on purpose (see questionCount in quizzes.ts).
const messageCount = sql<number>`(
  select count(*) from ${message} where ${message}.post_id = ${post}.id and ${message}.deleted_at is null
)`.mapWith(Number);

export const listCommunityPosts = cache(async (communityId: string) => {
  return db
    .select({ ...postWithAuthor, messageCount })
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(eq(post.communityId, communityId))
    .orderBy(desc(post.createdAt))
    .limit(100);
});

export async function getPost(postId: string) {
  const [row] = await db.select(postWithAuthor).from(post).innerJoin(user, eq(user.id, post.authorId)).where(eq(post.id, postId));
  return row;
}

export function canDeletePost(role: MemberRole | undefined, authorId: string, userId: string) {
  return authorId === userId || role === "owner" || role === "moderator";
}

/** The post plus the viewer's role, or null if the post doesn't exist or is private to them. */
export async function getPostAccess(postId: string, userId: string) {
  const [row] = await db
    .select({ postId: post.id, communityId: community.id, visibility: community.visibility })
    .from(post)
    .innerJoin(community, eq(community.id, post.communityId))
    .where(eq(post.id, postId));
  if (!row) return null;
  const membership = await getMembership(row.communityId, userId);
  if (row.visibility === "private" && !membership) return null;
  return { ...row, role: membership?.role };
}

export async function getMessageInPost(messageId: string, postId: string) {
  return db.query.message.findFirst({
    where: and(eq(message.id, messageId), eq(message.postId, postId), isNull(message.deletedAt)),
  });
}
