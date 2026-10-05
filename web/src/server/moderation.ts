import { and, count, desc, eq, isNotNull, min, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { community } from "@/db/schema/communities";
import { message } from "@/db/schema/messages";
import { post } from "@/db/schema/posts";
import { quiz } from "@/db/schema/quizzes";
import { report, reportTarget } from "@/db/schema/reports";
import { postTopic, publish } from "@/server/realtime";
import { deleteFile } from "@/server/storage";

export type TargetType = (typeof reportTarget.enumValues)[number];

export type ReportTargetInfo = {
  type: TargetType;
  id: string;
  communityId: string;
  slug: string;
  authorId: string;
  authorName: string;
  preview: string;
  href: string;
};

/** Looks up the reported item (if it still exists) with what moderators need to judge it. */
export async function getReportTarget(type: TargetType, id: string): Promise<ReportTargetInfo | null> {
  if (type === "message") {
    const [row] = await db
      .select({
        postId: message.postId,
        authorId: message.authorId,
        authorName: user.name,
        kind: message.kind,
        body: message.body,
        deletedAt: message.deletedAt,
        communityId: community.id,
        slug: community.slug,
      })
      .from(message)
      .innerJoin(post, eq(post.id, message.postId))
      .innerJoin(community, eq(community.id, post.communityId))
      .innerJoin(user, eq(user.id, message.authorId))
      .where(eq(message.id, id));
    if (!row || row.deletedAt) return null;
    return {
      type,
      id,
      communityId: row.communityId,
      slug: row.slug,
      authorId: row.authorId,
      authorName: row.authorName,
      preview: row.kind === "voice" ? "🎤 Voice note" : row.body,
      href: `/c/${row.slug}/p/${row.postId}#msg-${id}`,
    };
  }
  const table = type === "post" ? post : quiz;
  const [row] = await db
    .select({ authorId: table.authorId, authorName: user.name, title: table.title, communityId: community.id, slug: community.slug })
    .from(table)
    .innerJoin(community, eq(community.id, table.communityId))
    .innerJoin(user, eq(user.id, table.authorId))
    .where(eq(table.id, id));
  if (!row) return null;
  return { type, id, ...row, preview: row.title, href: `/c/${row.slug}/${type === "post" ? "p" : "q"}/${id}` };
}

/** Soft-deletes a message, removes its audio and tells live viewers. */
export async function removeMessage(existing: { id: string; postId: string; audioKey: string | null }) {
  await db.update(message).set({ deletedAt: new Date(), body: "" }).where(eq(message.id, existing.id));
  if (existing.audioKey) await deleteFile(existing.audioKey);
  await publish({ topic: postTopic(existing.postId), type: "message.deleted", id: existing.id });
}

/** Deletes a post (its messages cascade) and the voice-note files those messages pointed to. */
export async function deletePostWithMedia(postId: string) {
  const audio = await db
    .select({ key: message.audioKey })
    .from(message)
    .where(and(eq(message.postId, postId), isNotNull(message.audioKey)));
  await db.delete(post).where(eq(post.id, postId));
  await Promise.all(audio.map((a) => deleteFile(a.key!)));
}

export async function removeTarget(type: TargetType, id: string) {
  if (type === "message") {
    const existing = await db.query.message.findFirst({ where: eq(message.id, id) });
    if (existing && !existing.deletedAt) await removeMessage(existing);
  } else if (type === "post") {
    await deletePostWithMedia(id);
  } else {
    await db.delete(quiz).where(eq(quiz.id, id));
  }
}

/** Open reports for a community, grouped per reported item, most-reported first. */
export async function getModerationQueue(communityId: string) {
  const groups = await db
    .select({
      targetType: report.targetType,
      targetId: report.targetId,
      reports: count(),
      // Cast to text[]: node-postgres can't parse arrays of custom enum types.
      reasons: sql<string[]>`array_agg(distinct ${report.reason}::text)`,
      details: sql<string[]>`array_remove(array_agg(${report.details}), '')`,
      firstReportedAt: min(report.createdAt),
    })
    .from(report)
    .where(and(eq(report.communityId, communityId), eq(report.status, "open")))
    .groupBy(report.targetType, report.targetId)
    .orderBy(desc(count()), min(report.createdAt))
    .limit(50);

  return Promise.all(groups.map(async (g) => ({ ...g, target: await getReportTarget(g.targetType, g.targetId) })));
}

export async function countOpenReports(communityId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(distinct (${report.targetType}, ${report.targetId}))`.mapWith(Number) })
    .from(report)
    .where(and(eq(report.communityId, communityId), eq(report.status, "open")));
  return row.n;
}
