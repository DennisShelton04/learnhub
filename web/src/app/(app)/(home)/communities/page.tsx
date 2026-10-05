import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CommunityCard } from "@/components/CommunityCard";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { buttonStyles, inputStyles } from "@/components/styles";
import { requireUser } from "@/lib/session";
import { listPublicCommunities, listUserCommunities } from "@/server/communities";

export const metadata: Metadata = { title: "Communities · LearnHub" };

export default async function CommunitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const search = q?.trim() || undefined;
  const [communities, mine] = await Promise.all([listPublicCommunities(search), listUserCommunities(user.id)]);
  const joined = new Set(mine.map((c) => c.id));

  return (
    <>
      <ChannelHeader icon={<Compass className="h-5 w-5" />} title="Browse communities">
        <Link href="/communities/new" className={`${buttonStyles.primary} px-3 py-1.5`}>
          Create
        </Link>
      </ChannelHeader>
      <PageBody>
        <section className="rounded-xl bg-accent px-6 py-8 text-white">
          <h2 className="text-2xl font-bold">Find your people</h2>
          <p className="mt-1 text-white/80">Join a community to discuss videos and articles and learn together.</p>
        </section>

      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search communities…"
          aria-label="Search communities"
          className={`${inputStyles} flex-1`}
        />
        <button className={buttonStyles.secondary}>Search</button>
      </form>

      {communities.length === 0 ? (
        <p className="text-muted">
          {search ? `No communities match “${search}”.` : "No public communities yet. Be the first to create one!"}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {communities.map((c) => (
            <CommunityCard key={c.id} {...c} badge={joined.has(c.id) ? "Joined" : undefined} />
          ))}
        </div>
      )}
      </PageBody>
    </>
  );
}
