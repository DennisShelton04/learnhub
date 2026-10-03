/* eslint-disable @next/next/no-img-element -- preview images come from arbitrary sites */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { postTypeLabel } from "@/components/PostCard";
import { buttonStyles } from "@/components/styles";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getCommunityForViewer } from "@/server/communities";
import { deletePost } from "@/server/post-actions";
import { canDeletePost, getPost } from "@/server/posts";

export const metadata: Metadata = { title: "Post · LearnHub" };

type Props = { params: Promise<{ slug: string; postId: string }> };

export default async function PostPage({ params }: Props) {
  const { slug, postId } = await params;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  const post = await getPost(postId);
  if (!post || post.communityId !== community.id) notFound();

  return (
    <article className="flex flex-col gap-6">
      <Link href={`/c/${slug}`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← {community.name}
      </Link>

      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{postTypeLabel[post.type]}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
        <p className="text-sm text-zinc-500">
          Shared by {post.authorName} · {timeAgo(post.createdAt)}
        </p>
      </header>

      {post.type === "video" && post.videoId && (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
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
          className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 hover:border-zinc-400 sm:flex-row dark:border-zinc-800 dark:hover:border-zinc-600"
        >
          {post.previewImage && (
            <img
              src={post.previewImage}
              alt=""
              referrerPolicy="no-referrer"
              className="aspect-video w-full bg-zinc-100 object-cover sm:w-64 dark:bg-zinc-800"
            />
          )}
          <div className="flex min-w-0 flex-col gap-1 p-4">
            <p className="text-xs text-zinc-500">{post.previewSiteName}</p>
            <p className="font-semibold">{post.previewTitle ?? post.url}</p>
            {post.previewDescription && (
              <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">{post.previewDescription}</p>
            )}
            <p className="mt-2 text-sm font-medium">Read article ↗</p>
          </div>
        </a>
      )}

      {post.body && <p className="whitespace-pre-line text-zinc-800 dark:text-zinc-200">{post.body}</p>}

      {canDeletePost(role, post.authorId, user.id) && (
        <form action={deletePost.bind(null, post.id)}>
          <ConfirmSubmitButton message="Delete this post? This can't be undone." className={buttonStyles.danger}>
            Delete post
          </ConfirmSubmitButton>
        </form>
      )}

      <section className="rounded-lg border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Discussion</h2>
        <p className="mt-1 text-sm">Chat and voice notes for this post are coming next.</p>
      </section>
    </article>
  );
}
