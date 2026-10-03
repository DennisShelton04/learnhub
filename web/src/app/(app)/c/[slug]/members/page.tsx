import type { Metadata } from "next";
import { headers } from "next/headers";
import { CommunityHeader } from "@/components/CommunityHeader";
import { InviteLink } from "@/components/InviteLink";
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
    <div className="flex flex-col gap-8">
      <CommunityHeader community={community} memberCount={members.length} role={myRole} active="members" />

      {canManageMembers(myRole) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Invite people</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Anyone with this link can join.</p>
          <InviteLink url={inviteUrl} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Members</h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((m) => {
            const isMe = m.userId === user.id;
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-medium">
                  {m.name}
                  {isMe && <span className="font-normal text-zinc-500"> (you)</span>}
                </span>
                {m.role !== "member" && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize dark:bg-zinc-800">{m.role}</span>
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
                        <button className={`${buttonStyles.small} text-red-700 dark:text-red-400`}>Remove</button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
