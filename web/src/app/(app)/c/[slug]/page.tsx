import type { Metadata } from "next";
import { CommunityHeader } from "@/components/CommunityHeader";
import { PostCard } from "@/components/PostCard";
import { requireUser } from "@/lib/session";
import { countMembers, getCommunityBySlug, getCommunityForViewer } from "@/server/communities";
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
    <div className="flex flex-col gap-6">
      <CommunityHeader community={community} memberCount={memberCount} role={role} active="posts" />

      {posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No posts yet. {role ? "Share a video, article or note to start the conversation." : "Join to share the first one."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} communitySlug={community.slug} />
          ))}
        </div>
      )}
    </div>
  );
}
