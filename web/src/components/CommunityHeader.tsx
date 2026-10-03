import Link from "next/link";
import { buttonStyles } from "@/components/styles";
import type { MemberRole } from "@/server/communities";
import { joinCommunity, leaveCommunity } from "@/server/community-actions";

type Props = {
  community: { id: string; slug: string; name: string; description: string; visibility: "public" | "private" };
  memberCount: number;
  role: MemberRole | undefined;
  active: "posts" | "members";
};

export function CommunityHeader({ community, memberCount, role, active }: Props) {
  const tab = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`border-b-2 px-1 pb-2 text-sm font-medium ${
        isActive
          ? "border-zinc-900 dark:border-zinc-100"
          : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        {community.visibility === "private" ? "Private" : "Public"} community · {memberCount}{" "}
        {memberCount === 1 ? "member" : "members"}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{community.name}</h1>
      {community.description && (
        <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{community.description}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {role ? (
          <Link href={`/c/${community.slug}/new`} className={buttonStyles.primary}>
            Share something
          </Link>
        ) : (
          <form action={joinCommunity.bind(null, community.id)}>
            <button className={buttonStyles.primary}>Join community</button>
          </form>
        )}
        {role && role !== "owner" && (
          <form action={leaveCommunity.bind(null, community.id)}>
            <button className={buttonStyles.secondary}>Leave</button>
          </form>
        )}
      </div>
      <nav className="flex gap-6 border-b border-zinc-200 dark:border-zinc-800">
        {tab(`/c/${community.slug}`, "Posts", active === "posts")}
        {tab(`/c/${community.slug}/members`, "Members", active === "members")}
      </nav>
    </section>
  );
}
