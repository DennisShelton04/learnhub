"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { report } from "@/db/schema/reports";
import { requireUser } from "@/lib/session";
import { canManageMembers, getMembership } from "@/server/communities";
import { getReportTarget, removeTarget } from "@/server/moderation";

const reportSchema = z.object({
  targetType: z.enum(["post", "message", "quiz"]),
  targetId: z.string().min(1),
  reason: z.enum(["spam", "harassment", "inappropriate", "misinformation", "other"]),
  details: z.string().trim().max(500, "Details can be up to 500 characters."),
});

export type ReportInput = z.input<typeof reportSchema>;

export async function reportContent(input: ReportInput): Promise<{ error?: string; ok?: true }> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { targetType, targetId, reason, details } = parsed.data;

  const target = await getReportTarget(targetType, targetId);
  if (!target) return { error: "This content no longer exists." };
  const [membership, visibility] = await Promise.all([
    getMembership(target.communityId, user.id),
    db.query.community.findFirst({ where: (c, { eq }) => eq(c.id, target.communityId), columns: { visibility: true } }),
  ]);
  if (visibility?.visibility === "private" && !membership) return { error: "This content no longer exists." };
  if (target.authorId === user.id) return { error: "You can't report your own content." };

  const inserted = await db
    .insert(report)
    .values({ communityId: target.communityId, reporterId: user.id, targetType, targetId, reason, details })
    .onConflictDoNothing()
    .returning({ id: report.id });
  if (inserted.length === 0) return { error: "You've already reported this. Moderators will take a look." };

  revalidatePath(`/c/${target.slug}`, "layout");
  return { ok: true };
}

/** Moderator decision on every open report about one item: remove the content or dismiss. */
export async function resolveReports(communityId: string, targetType: "post" | "message" | "quiz", targetId: string, decision: "removed" | "dismissed") {
  const user = await requireUser();
  const membership = await getMembership(communityId, user.id);
  if (!canManageMembers(membership?.role)) throw new Error("Only moderators can review reports.");

  const target = await getReportTarget(targetType, targetId);
  // Reports always belong to the community they were filed in; double-check the item does too.
  if (target && target.communityId !== communityId) throw new Error("That item isn't in this community.");
  if (decision === "removed" && target) await removeTarget(targetType, targetId);

  const updated = await db
    .update(report)
    .set({ status: decision, resolvedBy: user.id, resolvedAt: new Date() })
    .where(
      and(eq(report.communityId, communityId), eq(report.targetType, targetType), eq(report.targetId, targetId), eq(report.status, "open")),
    )
    .returning({ id: report.id });
  if (updated.length > 0) {
    const slug = target?.slug ?? (await db.query.community.findFirst({ where: (c, { eq }) => eq(c.id, communityId) }))?.slug;
    if (slug) revalidatePath(`/c/${slug}`, "layout");
  }
}
