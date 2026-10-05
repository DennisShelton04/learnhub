"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { message } from "@/db/schema/messages";
import { requireUser } from "@/lib/session";
import { type ChatMessage, getChatMessage } from "@/server/messages";
import { removeMessage } from "@/server/moderation";
import { notifyAboutMessage } from "@/server/notifications";
import { canDeletePost, getMessageInPost, getPostAccess } from "@/server/posts";
import { postTopic, publish } from "@/server/realtime";
import { awardXp } from "@/server/xp";

const bodySchema = z.string().trim().min(1, "Message can't be empty.").max(2000, "Messages can be up to 2000 characters.");

export type SendMessageResult = { message: ChatMessage } | { error: string };

export async function sendMessage(postId: string, body: string, parentId: string | null): Promise<SendMessageResult> {
  const user = await requireUser();
  const access = await getPostAccess(postId, user.id);
  if (!access) return { error: "This post no longer exists." };
  if (!access.role) return { error: "Join this community to take part in the discussion." };

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parentId && !(await getMessageInPost(parentId, postId))) {
    return { error: "The message you're replying to was deleted." };
  }

  const [created] = await db
    .insert(message)
    .values({ postId, authorId: user.id, parentId, body: parsed.data })
    .returning({ id: message.id });
  await publish({ topic: postTopic(postId), type: "message.created", id: created.id });
  await awardXp({ userId: user.id, communityId: access.communityId, kind: "message_sent", refId: created.id });
  await notifyAboutMessage(created.id);
  return { message: (await getChatMessage(created.id))! };
}

export async function deleteMessage(messageId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await db.query.message.findFirst({ where: eq(message.id, messageId) });
  if (!existing || existing.deletedAt) return {};
  const access = await getPostAccess(existing.postId, user.id);
  // Same rule as posts: the author, moderators and the owner can delete.
  if (!access || !canDeletePost(access.role, existing.authorId, user.id)) {
    return { error: "You don't have permission to delete this message." };
  }

  await removeMessage(existing);
  return {};
}
