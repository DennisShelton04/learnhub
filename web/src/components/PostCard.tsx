/* eslint-disable @next/next/no-img-element -- preview images come from arbitrary sites */
import Link from "next/link";
import { timeAgo } from "@/lib/format";
import type { PostWithAuthor } from "@/server/posts";

export const postTypeLabel = { video: "Video", article: "Article", note: "Note" } as const;

export function PostCard({ post, communitySlug }: { post: PostWithAuthor; communitySlug: string }) {
  return (
    <Link
      href={`/c/${communitySlug}/p/${post.id}`}
      className="flex gap-4 rounded-lg border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      {post.previewImage && (
        <img
          src={post.previewImage}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-video w-28 shrink-0 rounded-md bg-zinc-100 object-cover sm:w-40 dark:bg-zinc-800"
        />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {postTypeLabel[post.type]}
          {post.previewSiteName && post.type !== "note" && ` · ${post.previewSiteName}`}
        </p>
        <h3 className="line-clamp-2 font-semibold">{post.title}</h3>
        {post.type === "note" && <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{post.body}</p>}
        <p className="mt-auto text-xs text-zinc-500">
          {post.authorName} · {timeAgo(post.createdAt)}
        </p>
      </div>
    </Link>
  );
}
