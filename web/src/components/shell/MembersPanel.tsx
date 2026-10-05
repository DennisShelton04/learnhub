import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { listMembers } from "@/server/communities";

const groups = [
  { role: "owner", title: "Owner" },
  { role: "moderator", title: "Moderators" },
  { role: "member", title: "Members" },
] as const;

/** Right-hand member list, shown on wide screens. */
export async function MembersPanel({ communityId }: { communityId: string }) {
  const members = await listMembers(communityId);
  return (
    <aside aria-label="Members" className="scroll-thin hidden w-60 shrink-0 overflow-y-auto bg-sidebar px-2 py-4 xl:block">
      {groups.map(({ role, title }) => {
        const list = members.filter((m) => m.role === role);
        if (list.length === 0) return null;
        return (
          <section key={role} className="mb-4">
            <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-subtle">
              {title} — {list.length}
            </h3>
            <ul>
              {list.map((m) => (
                <li key={m.userId}>
                  <Link href={`/u/${m.userId}`} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-hover">
                    <Avatar name={m.name} seed={m.userId} size="sm" />
                    <span className="truncate text-[15px] text-muted">{m.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}
