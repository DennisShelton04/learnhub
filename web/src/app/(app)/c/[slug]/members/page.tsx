import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Avatar } from "@/components/Avatar";
import { InviteLink } from "@/components/InviteLink";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/session";
import {
  canChangeRoles,
  canManageMembers,
  canRemoveMember,
  getCommunityForViewer,
  listMembers,
} from "@/server/communities";
import { removeMember, setMemberRole } from "@/server/community-actions";

export const metadata: Metadata = { title: "Members · LearnHub" };

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { community, role: myRole } = await getCommunityForViewer(slug, user.id);
  const members = await listMembers(community.id);
  const h = await headers();
  const inviteUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/join/${community.inviteCode}`;

  return (
    <>
      <ChannelHeader icon={<Users className="h-5 w-5" />} title="members" />
      <PageBody width="max-w-3xl">

      {canManageMembers(myRole) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Invite people</h2>
          <p className="text-sm text-muted">Anyone with this link can join.</p>
          <InviteLink url={inviteUrl} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Members — {members.length}</h2>
        <ul className="flex flex-col rounded-lg bg-sidebar p-1">
          {members.map((m) => {
            const isMe = m.userId === user.id;
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 rounded px-3 py-2 hover:bg-hover">
                <Avatar name={m.name} seed={m.userId} size="sm" />
                <Link href={`/u/${m.userId}`} className="font-medium hover:underline">
                  {m.name}
                  {isMe && <span className="font-normal text-subtle"> (you)</span>}
                </Link>
                {m.role !== "member" && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs capitalize text-accent">{m.role}</span>
                )}
                {!isMe && (
                  <div className="ml-auto flex gap-2">
                    {canChangeRoles(myRole) && m.role !== "owner" && (
                      <form action={setMemberRole.bind(null, community.id, m.userId)}>
                        <input type="hidden" name="role" value={m.role === "moderator" ? "member" : "moderator"} />
                        <button className={buttonStyles.small}>
                          {m.role === "moderator" ? "Remove moderator" : "Make moderator"}
                        </button>
                      </form>
                    )}
                    {canRemoveMember(myRole, m.role) && (
                      <form action={removeMember.bind(null, community.id, m.userId)}>
                        <button className={`${buttonStyles.small} text-danger`}>Remove</button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      </PageBody>
    </>
  );
}
