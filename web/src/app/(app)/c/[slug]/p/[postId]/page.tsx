/* eslint-disable @next/next/no-img-element -- preview images come from arbitrary sites */
import { Headphones, ListChecks, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Discussion } from "@/components/Discussion";
import { postTypeIcon, postTypeLabel } from "@/components/PostCard";
import { ReportButton } from "@/components/ReportButton";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { MembersPanel } from "@/components/shell/MembersPanel";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { canManageMembers, getCommunityForViewer } from "@/server/communities";
import { listMessages } from "@/server/messages";
import { deletePost } from "@/server/post-actions";
import { canDeletePost, getPost } from "@/server/posts";
import { listPostQuizzes } from "@/server/quizzes";
import { listActiveParticipants } from "@/server/rooms";

export const metadata: Metadata = { title: "Post · LearnHub" };

export default async function PostPage({ params }: PageProps<"/c/[slug]/p/[postId]">) {
  const { slug, postId } = await params;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  const post = await getPost(postId);
  if (!post || post.communityId !== community.id) notFound();
  const Icon = postTypeIcon[post.type];
  const [quizzes, inRoom] = await Promise.all([listPostQuizzes(post.id), listActiveParticipants(post.id)]);

  const intro = (
    <article className="flex flex-col gap-4 px-4 pb-2 pt-6">
      <div className="flex flex-col gap-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-hover text-fg">
          <Icon className="h-7 w-7" />
        </span>
        <h2 className="text-2xl font-bold">{post.title}</h2>
        <p className="flex items-center gap-2 text-sm text-subtle">
          <Avatar name={post.authorName} seed={post.authorId} size="xs" />
          {postTypeLabel[post.type]} shared by <span className="font-medium text-muted">{post.authorName}</span> ·{" "}
          {timeAgo(post.createdAt)}
        </p>
      </div>

      {post.type === "video" && post.videoId && (
        <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-lg bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${post.videoId}`}
            title={post.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full"
          />
        </div>
      )}

      {post.type === "article" && post.url && (
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="flex max-w-3xl flex-col overflow-hidden rounded-lg border-l-4 border-accent bg-sidebar hover:bg-selected sm:flex-row"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
            <p className="text-xs text-subtle">{post.previewSiteName}</p>
            <p className="font-semibold text-accent">{post.previewTitle ?? post.url}</p>
            {post.previewDescription && <p className="line-clamp-3 text-sm text-muted">{post.previewDescription}</p>}
            <p className="mt-2 text-sm font-medium">Read article ↗</p>
          </div>
          {post.previewImage && (
            <img src={post.previewImage} alt="" referrerPolicy="no-referrer" className="aspect-video w-full bg-input object-cover sm:w-56" />
          )}
        </a>
      )}

      {post.body && <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed">{post.body}</p>}

      {(quizzes.length > 0 || role) && (
        <div className="flex max-w-3xl flex-wrap items-center gap-2">
          {role && (
            <Link
              href={`/c/${slug}/p/${post.id}/room`}
              className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              <Headphones className="h-4 w-4" />
              {post.type === "video" ? "Watch together" : "Study together"}
              {inRoom.length > 0 && ` · ${inRoom.length} here`}
            </Link>
          )}
          {quizzes.map((q) => (
            <Link
              key={q.id}
              href={`/c/${slug}/q/${q.id}`}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-white"
            >
              <ListChecks className="h-4 w-4" /> {q.title} · {q.questionCount}Q
            </Link>
          ))}
          {role && (
            <Link
              href={`/c/${slug}/quizzes/new?post=${post.id}`}
              className="flex items-center gap-1 rounded-full bg-hover px-3 py-1.5 text-sm text-muted hover:bg-selected hover:text-fg"
            >
              <Plus className="h-4 w-4" /> Create a quiz on this
            </Link>
          )}
        </div>
      )}
    </article>
  );

  return (
    <>
      <ChannelHeader icon={<Icon className="h-5 w-5" />} title={post.title}>
        {post.authorId !== user.id && <ReportButton targetType="post" targetId={post.id} />}
        {canDeletePost(role, post.authorId, user.id) && (
          <form action={deletePost.bind(null, post.id)}>
            <ConfirmSubmitButton
              message="Delete this post and its discussion? This can't be undone."
              className="flex items-center gap-1 rounded px-2 py-1 text-sm text-subtle hover:bg-hover hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete post</span>
            </ConfirmSubmitButton>
          </form>
        )}
      </ChannelHeader>
      <div className="flex min-h-0 flex-1">
        <Discussion
          postId={post.id}
          postTitle={post.title}
          intro={intro}
          initialMessages={await listMessages(post.id)}
          currentUserId={user.id}
          canPost={Boolean(role)}
          canModerate={canManageMembers(role)}
        />
        <MembersPanel communityId={community.id} />
      </div>
    </>
  );
}
