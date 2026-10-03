import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { post } from "@/db/schema/posts";
import type { MemberRole } from "@/server/communities";

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

export async function listCommunityPosts(communityId: string) {
  return db
    .select(postWithAuthor)
    .from(post)
    .innerJoin(user, eq(user.id, post.authorId))
    .where(eq(post.communityId, communityId))
    .orderBy(desc(post.createdAt))
    .limit(50);
}

export async function getPost(postId: string) {
  const [row] = await db.select(postWithAuthor).from(post).innerJoin(user, eq(user.id, post.authorId)).where(eq(post.id, postId));
  return row;
}

export function canDeletePost(role: MemberRole | undefined, authorId: string, userId: string) {
  return authorId === userId || role === "owner" || role === "moderator";
}
