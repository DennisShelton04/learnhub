"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { post } from "@/db/schema/posts";
import { requireUser } from "@/lib/session";
import { getCommunityBySlug, getMembership } from "@/server/communities";
import { deletePostWithMedia } from "@/server/moderation";
import { fetchArticlePreview, fetchYouTubePreview, parseYouTubeId } from "@/server/link-preview";
import { canDeletePost } from "@/server/posts";
import { awardXp } from "@/server/xp";

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const link = z
  .string()
  .trim()
  .max(2000, "That link is too long.")
  .refine(isHttpUrl, "Enter a valid link starting with http:// or https://");
const optionalTitle = z.string().trim().max(200, "Title must be 200 characters or less.");
const body = z.string().trim().max(5000, "Text must be 5000 characters or less.");

const postSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("video"), url: link, title: optionalTitle, body }),
  z.object({ type: z.literal("article"), url: link, title: optionalTitle, body }),
  z.object({
    type: z.literal("note"),
    title: optionalTitle.min(1, "Give your note a title."),
    body: body.min(1, "Write something for your note."),
  }),
]);

export type CreatePostState = { error?: string; values?: Record<string, string> };

export async function createPost(communitySlug: string, _prev: CreatePostState, formData: FormData): Promise<CreatePostState> {
  const user = await requireUser();
  const target = await getCommunityBySlug(communitySlug);
  if (!target) notFound();
  if (!(await getMembership(target.id, user.id))) {
    return { error: "Join this community to share posts." };
  }

  const raw = Object.fromEntries(["type", "url", "title", "body"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: raw };
  const data = parsed.data;

  let values: typeof post.$inferInsert;
  if (data.type === "video") {
    const videoId = parseYouTubeId(data.url);
    if (!videoId) return { error: "Only YouTube links are supported for videos right now.", values: raw };
    const preview = await fetchYouTubePreview(videoId);
    values = {
      communityId: target.id,
      authorId: user.id,
      type: "video",
      title: data.title || preview.title || "YouTube video",
      body: data.body,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      previewTitle: preview.title,
      previewDescription: preview.description,
      previewImage: preview.image,
      previewSiteName: preview.siteName,
    };
  } else if (data.type === "article") {
    const preview = await fetchArticlePreview(data.url);
    values = {
      communityId: target.id,
      authorId: user.id,
      type: "article",
      title: data.title || preview?.title || new URL(data.url).hostname,
      body: data.body,
      url: data.url,
      previewTitle: preview?.title,
      previewDescription: preview?.description,
      previewImage: preview?.image,
      previewSiteName: preview?.siteName ?? new URL(data.url).hostname.replace(/^www\./, ""),
    };
  } else {
    values = { communityId: target.id, authorId: user.id, type: "note", title: data.title, body: data.body };
  }

  const [created] = await db.insert(post).values(values).returning({ id: post.id });
  await awardXp({ userId: user.id, communityId: target.id, kind: "post_shared", refId: created.id });
  revalidatePath(`/c/${communitySlug}`, "layout");
  redirect(`/c/${communitySlug}/p/${created.id}`);
}

export async function deletePost(postId: string) {
  const user = await requireUser();
  const existing = await db.query.post.findFirst({ where: eq(post.id, postId) });
  if (!existing) notFound();
  const [membership, parent] = await Promise.all([
    getMembership(existing.communityId, user.id),
    db.query.community.findFirst({ where: (c, { eq }) => eq(c.id, existing.communityId), columns: { slug: true } }),
  ]);
  if (!canDeletePost(membership?.role, existing.authorId, user.id)) {
    throw new Error("You don't have permission to delete this post.");
  }

  await deletePostWithMedia(postId);
  revalidatePath(`/c/${parent!.slug}`, "layout");
  redirect(`/c/${parent!.slug}`);
}
