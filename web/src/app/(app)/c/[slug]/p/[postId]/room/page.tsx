import { ArrowLeft, Headphones } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Discussion } from "@/components/Discussion";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { StudyRoom } from "@/components/StudyRoom";
import { requireUser } from "@/lib/session";
import { canManageMembers, getCommunityForViewer } from "@/server/communities";
import { listMessages } from "@/server/messages";
import { getPost } from "@/server/posts";

export const metadata: Metadata = { title: "Study room · LearnHub" };

export default async function StudyRoomPage({ params }: PageProps<"/c/[slug]/p/[postId]/room">) {
  const { slug, postId } = await params;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  const post = await getPost(postId);
  if (!post || post.communityId !== community.id) notFound();

  return (
    <>
      <ChannelHeader icon={<Headphones className="h-5 w-5" />} title={`Study room: ${post.title}`}>
        <Link href={`/c/${slug}/p/${post.id}`} className="flex items-center gap-1 rounded px-2 py-1 text-sm text-subtle hover:bg-hover hover:text-fg">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to post</span>
        </Link>
      </ChannelHeader>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="scroll-thin shrink-0 overflow-y-auto p-4 lg:min-h-0 lg:flex-1">
          {role ? (
            <StudyRoom postId={post.id} videoId={post.videoId} currentUserId={user.id} />
          ) : (
            <p className="rounded-lg bg-sidebar p-6 text-muted">Join this community to use its study rooms.</p>
          )}
        </div>
        <div className="flex min-h-[50vh] flex-col border-line lg:min-h-0 lg:w-[420px] lg:border-l">
          <Discussion
            postId={post.id}
            postTitle={post.title}
            intro={null}
            initialMessages={await listMessages(post.id)}
            currentUserId={user.id}
            canPost={Boolean(role)}
            canModerate={canManageMembers(role)}
          />
        </div>
      </div>
    </>
  );
}
