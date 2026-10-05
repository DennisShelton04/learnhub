import { House } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CommunityCard } from "@/components/CommunityCard";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/session";
import { listUserCommunities } from "@/server/communities";

export const metadata: Metadata = { title: "Home · LearnHub" };

export default async function DashboardPage() {
  const user = await requireUser();
  const communities = await listUserCommunities(user.id);

  return (
    <>
      <ChannelHeader icon={<House className="h-5 w-5" />} title="Home" />
      <PageBody>
        <section className="rounded-xl bg-accent px-6 py-8 text-white">
          <h2 className="text-2xl font-bold">Hi, {user.name} 👋</h2>
          <p className="mt-1 text-white/80">Pick a community from the left, or find a new one to learn with.</p>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Your communities — {communities.length}</h2>
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
            <p className="rounded-lg border border-dashed border-line p-6 text-muted">
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
      </PageBody>
    </>
  );
}
