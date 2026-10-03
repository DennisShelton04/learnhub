import type { Metadata } from "next";
import Link from "next/link";
import { CommunityCard } from "@/components/CommunityCard";
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Communities</h1>
        <Link href="/communities/new" className={buttonStyles.primary}>
          Create community
        </Link>
      </div>

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
        <p className="text-zinc-600 dark:text-zinc-400">
          {search ? `No communities match “${search}”.` : "No public communities yet. Be the first to create one!"}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {communities.map((c) => (
            <CommunityCard key={c.id} {...c} badge={joined.has(c.id) ? "Joined" : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
