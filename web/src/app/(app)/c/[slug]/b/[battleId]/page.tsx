import { Swords } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BattleRoom } from "@/components/BattleRoom";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { requireUser } from "@/lib/session";
import { getCommunityForViewer } from "@/server/communities";
import { getBattleState } from "@/server/battles";

export const metadata: Metadata = { title: "Live battle · LearnHub" };

export default async function BattlePage({ params }: PageProps<"/c/[slug]/b/[battleId]">) {
  const { slug, battleId } = await params;
  const user = await requireUser();
  const { community } = await getCommunityForViewer(slug, user.id);
  const state = await getBattleState(battleId, user.id);
  if (!state) notFound();
  const h = await headers();
  const inviteUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/c/${community.slug}/b/${battleId}`;

  return (
    <>
      <ChannelHeader icon={<Swords className="h-5 w-5" />} title={`Battle: ${state.quizTitle}`} />
      <PageBody width="max-w-3xl">
        <BattleRoom initial={state} slug={community.slug} inviteUrl={inviteUrl} />
      </PageBody>
    </>
  );
}
