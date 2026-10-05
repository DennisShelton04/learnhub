import { Lock } from "lucide-react";
import Link from "next/link";
import { initials } from "@/components/Avatar";

type Props = {
  slug: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  memberCount?: number;
  badge?: string;
};

export function CommunityCard({ slug, name, description, visibility, memberCount, badge }: Props) {
  return (
    <Link href={`/c/${slug}`} className="flex gap-4 rounded-lg bg-sidebar p-4 transition-colors hover:bg-selected">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-sm font-semibold text-white">
        {initials(name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold">{name}</h3>
          {badge && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs capitalize text-accent">{badge}</span>}
        </div>
        {description && <p className="line-clamp-2 text-sm text-muted">{description}</p>}
        <p className="mt-auto flex items-center gap-1 text-xs text-subtle">
          {visibility === "private" && <Lock className="h-3 w-3" />}
          {visibility === "private" ? "Private" : "Public"}
          {memberCount !== undefined && ` · ${memberCount} ${memberCount === 1 ? "member" : "members"}`}
        </p>
      </div>
    </Link>
  );
}
