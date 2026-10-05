import { and, count, desc, eq, ilike } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { community, communityMember } from "@/db/schema/communities";

export type MemberRole = (typeof communityMember.$inferSelect)["role"];

const summaryFields = {
  id: community.id,
  slug: community.slug,
  name: community.name,
  description: community.description,
  visibility: community.visibility,
  memberCount: count(communityMember.userId),
};

export async function listPublicCommunities(search?: string) {
  return db
    .select(summaryFields)
    .from(community)
    .leftJoin(communityMember, eq(communityMember.communityId, community.id))
    .where(
      and(
        eq(community.visibility, "public"),
        search ? ilike(community.name, `%${search}%`) : undefined,
      ),
    )
    .groupBy(community.id)
    .orderBy(desc(count(communityMember.userId)), desc(community.createdAt))
    .limit(50);
}

export const listUserCommunities = cache(async (userId: string) => {
  return db
    .select({
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description,
      visibility: community.visibility,
      role: communityMember.role,
    })
    .from(communityMember)
    .innerJoin(community, eq(community.id, communityMember.communityId))
    .where(eq(communityMember.userId, userId))
    .orderBy(desc(communityMember.joinedAt));
});

export async function getCommunityBySlug(slug: string) {
  return db.query.community.findFirst({ where: eq(community.slug, slug) });
}

export async function getCommunityByInviteCode(code: string) {
  return db.query.community.findFirst({ where: eq(community.inviteCode, code) });
}

/** Loads a community the viewer may see; 404s if missing or private to them. */
export const getCommunityForViewer = cache(async (slug: string, userId: string) => {
  const found = await getCommunityBySlug(slug);
  if (!found) notFound();
  const membership = await getMembership(found.id, userId);
  if (found.visibility === "private" && !membership) notFound();
  return { community: found, role: membership?.role };
});

export async function countMembers(communityId: string) {
  const [row] = await db.select({ n: count() }).from(communityMember).where(eq(communityMember.communityId, communityId));
  return row.n;
}

export async function getMembership(communityId: string, userId: string) {
  return db.query.communityMember.findFirst({
    where: and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId)),
  });
}

export async function listMembers(communityId: string) {
  return db
    .select({ userId: user.id, name: user.name, image: user.image, role: communityMember.role, joinedAt: communityMember.joinedAt })
    .from(communityMember)
    .innerJoin(user, eq(user.id, communityMember.userId))
    .where(eq(communityMember.communityId, communityId))
    .orderBy(communityMember.joinedAt);
}

// Permission rules, kept in one place so pages and actions agree.

export function canManageMembers(role: MemberRole | undefined) {
  return role === "owner" || role === "moderator";
}

export function canRemoveMember(actor: MemberRole | undefined, target: MemberRole) {
  if (actor === "owner") return target !== "owner";
  if (actor === "moderator") return target === "member";
  return false;
}

export function canChangeRoles(actor: MemberRole | undefined) {
  return actor === "owner";
}
