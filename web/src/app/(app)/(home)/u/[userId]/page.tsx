import { eq } from "drizzle-orm";
import { User } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { CommunityCard } from "@/components/CommunityCard";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { XpBar } from "@/components/XpBar";
import { db } from "@/db";
import { user as userTable } from "@/db/schema/auth";
import { requireUser } from "@/lib/session";
import { listUserCommunities } from "@/server/communities";
import { getUserStats } from "@/server/xp";

export const metadata: Metadata = { title: "Profile · LearnHub" };

const joinedFmt = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

export default async function ProfilePage({ params }: PageProps<"/u/[userId]">) {
  const { userId } = await params;
  const viewer = await requireUser();
  const profile = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: { id: true, name: true, createdAt: true },
  });
  if (!profile) notFound();

  const [stats, theirs, mine] = await Promise.all([
    getUserStats(profile.id),
    listUserCommunities(profile.id),
    listUserCommunities(viewer.id),
  ]);
  // Only show communities the viewer could see: public ones, or private ones they share.
  const mineIds = new Set(mine.map((c) => c.id));
  const visible = theirs.filter((c) => c.visibility === "public" || mineIds.has(c.id));
  const isMe = profile.id === viewer.id;
  const earned = stats.badges.filter((b) => b.earned).length;

  return (
    <>
      <ChannelHeader icon={<User className="h-5 w-5" />} title={isMe ? "Your profile" : profile.name} />
      <PageBody width="max-w-3xl">
        <section className="overflow-hidden rounded-xl bg-sidebar">
          <div className="h-24 bg-accent" />
          <div className="-mt-10 flex flex-col gap-4 px-6 pb-6">
            <div className="w-fit rounded-full border-[6px] border-sidebar">
              <span className="block scale-[2] p-3">
                <Avatar name={profile.name} seed={profile.id} size="sm" />
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{profile.name}</h2>
              <p className="text-sm text-subtle">Learning on LearnHub since {joinedFmt.format(profile.createdAt)}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Total XP", value: stats.xp },
                { label: "Day streak", value: `🔥 ${stats.streak.current}` },
                { label: "Best streak", value: stats.streak.longest },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-main p-3">
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-subtle">{s.label}</p>
                </div>
              ))}
            </div>
            <XpBar level={stats.level} progress={stats.progress} toNext={stats.toNext} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">
            Badges — {earned} of {stats.badges.length}
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.badges.map((b) => (
              <li
                key={b.id}
                className={`flex items-center gap-3 rounded-lg p-3 ${b.earned ? "bg-accent-soft" : "bg-sidebar opacity-50 grayscale"}`}
              >
                <span className="text-2xl" aria-hidden>
                  {b.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{b.name}</span>
                  <span className="block text-xs text-subtle">
                    {b.earned ? "Earned" : "Locked"} · {b.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Communities — {visible.length}</h3>
          {visible.length === 0 ? (
            <p className="text-sm text-subtle">No communities to show.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map((c) => (
                <CommunityCard key={c.id} {...c} badge={c.role !== "member" ? c.role : undefined} />
              ))}
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}
