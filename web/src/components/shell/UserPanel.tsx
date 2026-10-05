import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { SignOutButton } from "@/components/SignOutButton";
import { countUnread } from "@/server/notifications";
import { getUserStats } from "@/server/xp";

export async function UserPanel({ user }: { user: { id: string; name: string } }) {
  const [stats, unread] = await Promise.all([getUserStats(user.id), countUnread(user.id)]);
  return (
    <div className="flex items-center gap-1 bg-elevated/60 px-2 py-2">
      <Link
        href={`/u/${user.id}`}
        aria-label="Your profile"
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 hover:bg-hover"
      >
        <Avatar name={user.name} seed={user.id} size="sm" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-subtle">
            Level {stats.level} · {stats.xp} XP{stats.streak.current > 0 && ` · 🔥 ${stats.streak.current}`}
          </span>
        </span>
      </Link>
      <NotificationBell initialUnread={unread} />
      <SignOutButton />
    </div>
  );
}
