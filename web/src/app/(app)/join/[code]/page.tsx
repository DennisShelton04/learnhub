import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/session";
import { getCommunityByInviteCode, getMembership } from "@/server/communities";
import { joinByInvite } from "@/server/community-actions";

export const metadata: Metadata = { title: "Join community · LearnHub" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const community = await getCommunityByInviteCode(code);
  if (!community) notFound();
  if (await getMembership(community.id, user.id)) redirect(`/c/${community.slug}`);

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <p className="text-sm text-zinc-500">You&apos;ve been invited to join</p>
      <h1 className="text-3xl font-semibold tracking-tight">{community.name}</h1>
      {community.description && <p className="text-zinc-700 dark:text-zinc-300">{community.description}</p>}
      <form action={joinByInvite.bind(null, code)}>
        <button className={buttonStyles.primary}>Join community</button>
      </form>
    </div>
  );
}
