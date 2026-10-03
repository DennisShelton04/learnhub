"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { community, communityMember } from "@/db/schema/communities";
import { requireUser } from "@/lib/session";
import {
  canChangeRoles,
  canRemoveMember,
  getCommunityByInviteCode,
  getMembership,
} from "@/server/communities";

const createSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters.").max(60, "Name must be 60 characters or less."),
  description: z.string().trim().max(500, "Description must be 500 characters or less."),
  visibility: z.enum(["public", "private"]),
});

export type CreateCommunityState = { error?: string; values?: Record<string, string> };

function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || "community";
}

function randomToken(bytes: number) {
  return randomBytes(bytes).toString("base64url");
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  const taken = await db.query.community.findFirst({ where: eq(community.slug, base), columns: { id: true } });
  return taken ? `${base}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "x")}` : base;
}

export async function createCommunity(_prev: CreateCommunityState, formData: FormData): Promise<CreateCommunityState> {
  const user = await requireUser();
  const raw = {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    visibility: String(formData.get("visibility") ?? "public"),
  };
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: raw };
  }

  const slug = await uniqueSlug(parsed.data.name);
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(community)
      .values({ ...parsed.data, slug, inviteCode: randomToken(9), createdBy: user.id })
      .returning({ id: community.id });
    await tx.insert(communityMember).values({ communityId: created.id, userId: user.id, role: "owner" });
  });

  revalidatePath("/communities");
  redirect(`/c/${slug}`);
}

export async function joinCommunity(communityId: string) {
  const user = await requireUser();
  const target = await db.query.community.findFirst({ where: eq(community.id, communityId) });
  if (!target || target.visibility !== "public") notFound();

  await db.insert(communityMember).values({ communityId, userId: user.id }).onConflictDoNothing();
  revalidatePath(`/c/${target.slug}`);
}

export async function joinByInvite(inviteCode: string) {
  const user = await requireUser();
  const target = await getCommunityByInviteCode(inviteCode);
  if (!target) notFound();

  await db.insert(communityMember).values({ communityId: target.id, userId: user.id }).onConflictDoNothing();
  redirect(`/c/${target.slug}`);
}

export async function leaveCommunity(communityId: string) {
  const user = await requireUser();
  const membership = await getMembership(communityId, user.id);
  if (!membership) return;
  if (membership.role === "owner") throw new Error("Owners can't leave their own community.");

  await db
    .delete(communityMember)
    .where(and(eq(communityMember.communityId, communityId), eq(communityMember.userId, user.id)));
  redirect("/communities");
}

export async function setMemberRole(communityId: string, memberId: string, formData: FormData) {
  const user = await requireUser();
  const role = z.enum(["moderator", "member"]).parse(formData.get("role"));
  const [actor, target] = await Promise.all([getMembership(communityId, user.id), getMembership(communityId, memberId)]);
  if (!target || target.role === "owner" || !canChangeRoles(actor?.role)) {
    throw new Error("You don't have permission to change this member's role.");
  }

  await db
    .update(communityMember)
    .set({ role })
    .where(and(eq(communityMember.communityId, communityId), eq(communityMember.userId, memberId)));
  await revalidateCommunity(communityId);
}

export async function removeMember(communityId: string, memberId: string) {
  const user = await requireUser();
  const [actor, target] = await Promise.all([getMembership(communityId, user.id), getMembership(communityId, memberId)]);
  if (!target || !canRemoveMember(actor?.role, target.role)) {
    throw new Error("You don't have permission to remove this member.");
  }

  await db
    .delete(communityMember)
    .where(and(eq(communityMember.communityId, communityId), eq(communityMember.userId, memberId)));
  await revalidateCommunity(communityId);
}

async function revalidateCommunity(communityId: string) {
  const c = await db.query.community.findFirst({ where: eq(community.id, communityId), columns: { slug: true } });
  if (c) revalidatePath(`/c/${c.slug}`);
}
