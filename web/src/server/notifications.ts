import { and, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { battle } from "@/db/schema/battles";
import { community, communityMember } from "@/db/schema/communities";
import { message } from "@/db/schema/messages";
import { notification, notificationKind } from "@/db/schema/notifications";
import { post } from "@/db/schema/posts";
import { quiz } from "@/db/schema/quizzes";
import { publish, userTopic } from "@/server/realtime";

type Kind = (typeof notificationKind.enumValues)[number];
type NewNotification = { userId: string; actorId: string; kind: Kind; groupKey: string; title: string; body?: string; href: string };

const snippet = (text: string, max = 120) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Creates a notification, or refreshes an unread one in the same group, then pings the recipient live. */
async function notify(n: NewNotification) {
  const existing = await db.query.notification.findFirst({
    where: and(eq(notification.userId, n.userId), eq(notification.groupKey, n.groupKey), isNull(notification.readAt)),
  });
  if (existing) {
    await db
      .update(notification)
      .set({ actorId: n.actorId, title: n.title, body: n.body ?? "", href: n.href, createdAt: new Date() })
      .where(eq(notification.id, existing.id));
  } else {
    await db.insert(notification).values({ ...n, body: n.body ?? "" });
  }
  await publish({ topic: userTopic(n.userId), type: "notifications.changed", id: n.userId });
}

/** Notifies the replied-to person and the post's author about a new message. Never throws. */
export async function notifyAboutMessage(messageId: string) {
  try {
    const [row] = await db
      .select({
        id: message.id,
        kind: message.kind,
        body: message.body,
        parentId: message.parentId,
        authorId: message.authorId,
        authorName: user.name,
        postId: post.id,
        postTitle: post.title,
        postAuthorId: post.authorId,
        slug: community.slug,
      })
      .from(message)
      .innerJoin(user, eq(user.id, message.authorId))
      .innerJoin(post, eq(post.id, message.postId))
      .innerJoin(community, eq(community.id, post.communityId))
      .where(eq(message.id, messageId));
    if (!row) return;
    const href = `/c/${row.slug}/p/${row.postId}#msg-${row.id}`;
    const body = row.kind === "voice" ? "🎤 Voice note" : snippet(row.body);
    const notified = new Set<string>([row.authorId]);

    if (row.parentId) {
      const parent = await db.query.message.findFirst({ where: eq(message.id, row.parentId), columns: { authorId: true } });
      if (parent && !notified.has(parent.authorId)) {
        notified.add(parent.authorId);
        await notify({ userId: parent.authorId, actorId: row.authorId, kind: "reply", groupKey: `reply:${row.parentId}`, title: `${row.authorName} replied to you`, body, href });
      }
    }
    if (!notified.has(row.postAuthorId)) {
      await notify({
        userId: row.postAuthorId,
        actorId: row.authorId,
        kind: "post_comment",
        groupKey: `post:${row.postId}`,
        title: `${row.authorName} commented on “${snippet(row.postTitle, 60)}”`,
        body,
        href,
      });
    }
  } catch (err) {
    console.error("notifyAboutMessage failed", err);
  }
}

/** Tells community members a live battle is starting. Never throws. */
export async function notifyBattleStarted(battleId: string) {
  try {
    const [row] = await db
      .select({ hostId: battle.hostId, hostName: user.name, communityId: battle.communityId, slug: community.slug, quizTitle: quiz.title })
      .from(battle)
      .innerJoin(user, eq(user.id, battle.hostId))
      .innerJoin(community, eq(community.id, battle.communityId))
      .innerJoin(quiz, eq(quiz.id, battle.quizId))
      .where(eq(battle.id, battleId));
    if (!row) return;
    const members = await db
      .select({ userId: communityMember.userId })
      .from(communityMember)
      .where(and(eq(communityMember.communityId, row.communityId), ne(communityMember.userId, row.hostId)))
      .limit(500);
    for (const m of members) {
      await notify({
        userId: m.userId,
        actorId: row.hostId,
        kind: "battle_started",
        groupKey: `battle:${battleId}`,
        title: `${row.hostName} is hosting a live quiz battle`,
        body: row.quizTitle,
        href: `/c/${row.slug}/b/${battleId}`,
      });
    }
  } catch (err) {
    console.error("notifyBattleStarted failed", err);
  }
}

export async function listNotifications(userId: string) {
  return db
    .select({
      id: notification.id,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      href: notification.href,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      actorId: notification.actorId,
      actorName: user.name,
    })
    .from(notification)
    .leftJoin(user, eq(user.id, notification.actorId))
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(50);
}

export const countUnread = cache(async (userId: string) => {
  const [row] = await db.select({ n: count() }).from(notification).where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return row.n;
});

export async function markRead(userId: string, ids?: string[]) {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt), ids ? inArray(notification.id, ids) : undefined));
  // Update the bell in every open tab.
  await publish({ topic: userTopic(userId), type: "notifications.changed", id: userId });
}
