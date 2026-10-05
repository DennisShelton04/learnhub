import { Medal, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { requireUser } from "@/lib/session";
import { getCommunityForViewer } from "@/server/communities";
import { getCommunityLeaderboard } from "@/server/xp";

export const metadata: Metadata = { title: "Leaderboard · LearnHub" };

const medal = ["text-amber-400", "text-zinc-400", "text-orange-500"];

export default async function LeaderboardPage({ params, searchParams }: PageProps<"/c/[slug]/leaderboard">) {
  const { slug } = await params;
  const { period } = await searchParams;
  const allTime = period === "all";
  const user = await requireUser();
  const { community } = await getCommunityForViewer(slug, user.id);
  const rows = await getCommunityLeaderboard(community.id, allTime ? "all" : "week");

  const tab = (label: string, href: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-sm font-medium ${active ? "bg-accent text-white" : "bg-hover text-muted hover:text-fg"}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <ChannelHeader icon={<Trophy className="h-5 w-5" />} title="leaderboard" />
      <PageBody width="max-w-2xl">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold">Top learners</h2>
          <p className="text-muted">XP earned in {community.name} by sharing, discussing and taking quizzes.</p>
        </div>
        <div className="flex gap-2">
          {tab("This week", `/c/${slug}/leaderboard`, !allTime)}
          {tab("All time", `/c/${slug}/leaderboard?period=all`, allTime)}
        </div>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-6 text-muted">
            No XP earned {allTime ? "yet" : "this week"}. Share something or take a quiz to get on the board!
          </p>
        ) : (
          <ol className="flex flex-col rounded-lg bg-sidebar p-1">
            {rows.map((r, i) => (
              <li key={r.userId}>
                <Link
                  href={`/u/${r.userId}`}
                  className={`flex items-center gap-3 rounded px-3 py-2.5 hover:bg-hover ${r.userId === user.id ? "bg-accent-soft" : ""}`}
                >
                  <span className="w-6 text-center text-sm font-semibold text-subtle">
                    {i < 3 ? <Medal className={`mx-auto h-5 w-5 ${medal[i]}`} aria-label={`Rank ${i + 1}`} /> : i + 1}
                  </span>
                  <Avatar name={r.name} seed={r.userId} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {r.name}
                    {r.userId === user.id && <span className="font-normal text-subtle"> (you)</span>}
                  </span>
                  <span className="font-semibold tabular-nums">{r.xp} XP</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </PageBody>
    </>
  );
}
