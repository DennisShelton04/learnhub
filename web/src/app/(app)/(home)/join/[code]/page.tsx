import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { initials } from "@/components/Avatar";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
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
    <>
      <ChannelHeader icon={<UserPlus className="h-5 w-5" />} title="Invitation" />
      <PageBody width="max-w-md">
        <div className="mt-8 flex flex-col items-center gap-4 rounded-xl bg-sidebar p-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-2xl font-bold text-white">
            {initials(community.name)}
          </span>
          <p className="text-sm text-muted">You&apos;ve been invited to join</p>
          <h2 className="text-2xl font-bold">{community.name}</h2>
          {community.description && <p className="text-muted">{community.description}</p>}
          <form action={joinByInvite.bind(null, code)} className="w-full">
            <button className={`${buttonStyles.primary} w-full`}>Join community</button>
          </form>
        </div>
      </PageBody>
    </>
  );
}
