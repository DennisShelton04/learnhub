import Link from "next/link";

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
    <Link
      href={`/c/${slug}`}
      className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{name}</h3>
        {badge && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize dark:bg-zinc-800">{badge}</span>
        )}
      </div>
      {description && <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
      <p className="mt-auto text-xs text-zinc-500">
        {visibility === "private" ? "Private" : "Public"}
        {memberCount !== undefined && ` · ${memberCount} ${memberCount === 1 ? "member" : "members"}`}
      </p>
    </Link>
  );
}
