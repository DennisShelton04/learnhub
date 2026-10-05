/* eslint-disable @next/next/no-img-element -- preview images come from arbitrary sites */
import { FileText, MessageSquare, StickyNote, Video } from "lucide-react";
import Link from "next/link";
import { timeAgo } from "@/lib/format";
import type { PostWithAuthor } from "@/server/posts";

export const postTypeLabel = { video: "Video", article: "Article", note: "Note" } as const;
export const postTypeIcon = { video: Video, article: FileText, note: StickyNote } as const;

export function PostCard({ post, communitySlug }: { post: PostWithAuthor; communitySlug: string }) {
  const Icon = postTypeIcon[post.type];
  return (
    <Link
      href={`/c/${communitySlug}/p/${post.id}`}
      className="flex gap-4 rounded-lg bg-sidebar p-3 transition-colors hover:bg-selected"
    >
      {post.previewImage && (
        <img
          src={post.previewImage}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-video w-28 shrink-0 rounded-md bg-input object-cover sm:w-40"
        />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-subtle">
          <Icon className="h-3.5 w-3.5" />
          {postTypeLabel[post.type]}
          {post.previewSiteName && post.type !== "note" && ` · ${post.previewSiteName}`}
        </p>
        <h3 className="line-clamp-2 font-semibold">{post.title}</h3>
        {post.type === "note" && <p className="line-clamp-2 text-sm text-muted">{post.body}</p>}
        <p className="mt-auto flex items-center gap-1 text-xs text-subtle">
          {post.authorName} · {timeAgo(post.createdAt)}
          {post.messageCount > 0 && (
            <>
              {" · "}
              <MessageSquare className="h-3 w-3" />
              {`${post.messageCount} ${post.messageCount === 1 ? "message" : "messages"}`}
            </>
          )}
        </p>
      </div>
    </Link>
  );
}
