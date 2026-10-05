import { Hash, Lock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { initials } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { MembersPanel } from "@/components/shell/MembersPanel";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/session";
import { countMembers, getCommunityBySlug, getCommunityForViewer } from "@/server/communities";
import { joinCommunity } from "@/server/community-actions";
import { listCommunityPosts } from "@/server/posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCommunityBySlug((await params).slug);
  return { title: c && c.visibility === "public" ? `${c.name} · LearnHub` : "Community · LearnHub" };
}

export default async function CommunityPage({ params }: Props) {
  const { slug } = await params;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  const [memberCount, posts] = await Promise.all([countMembers(community.id), listCommunityPosts(community.id)]);

  return (
    <>
      <ChannelHeader icon={<Hash className="h-5 w-5" />} title="welcome" />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <PageBody>
            <section className="flex flex-col items-start gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-xl font-bold text-white">
                {initials(community.name)}
              </span>
              <h2 className="text-3xl font-bold">Welcome to {community.name}</h2>
              {community.description && <p className="whitespace-pre-line text-muted">{community.description}</p>}
              <p className="flex items-center gap-3 text-sm text-subtle">
                <span className="flex items-center gap-1">
                  {community.visibility === "private" ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                  {community.visibility === "private" ? "Private community" : "Public community"}
                </span>
                <Link href={`/c/${slug}/members`} className="flex items-center gap-1 hover:text-fg">
                  <Users className="h-4 w-4" /> {memberCount} {memberCount === 1 ? "member" : "members"}
                </Link>
              </p>
              {role ? (
                <Link href={`/c/${slug}/new`} className={buttonStyles.primary}>
                  Share something
                </Link>
              ) : (
                <form action={joinCommunity.bind(null, community.id)}>
                  <button className={buttonStyles.primary}>Join community</button>
                </form>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Recent posts</h3>
              {posts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line p-6 text-muted">
                  No posts yet. {role ? "Share a video, article or note to start the conversation." : "Join to share the first one."}
                </p>
              ) : (
                posts.map((p) => <PostCard key={p.id} post={p} communitySlug={community.slug} />)
              )}
            </section>
          </PageBody>
        </div>
        <MembersPanel communityId={community.id} />
      </div>
    </>
  );
}
