import type { Metadata } from "next";
import Link from "next/link";
import { CommunityCard } from "@/components/CommunityCard";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/session";
import { listUserCommunities } from "@/server/communities";

export const metadata: Metadata = { title: "Home · LearnHub" };

export default async function DashboardPage() {
  const user = await requireUser();
  const communities = await listUserCommunities(user.id);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Hi, {user.name} 👋</h1>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Your communities</h2>
          <div className="flex gap-2">
            <Link href="/communities" className={buttonStyles.secondary}>
              Browse
            </Link>
            <Link href="/communities/new" className={buttonStyles.primary}>
              Create community
            </Link>
          </div>
        </div>

        {communities.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            You haven&apos;t joined any communities yet. Browse communities or create your own to start learning together.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {communities.map((c) => (
              <CommunityCard key={c.id} {...c} badge={c.role} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
