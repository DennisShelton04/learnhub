import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewPostForm } from "@/components/NewPostForm";
import { requireUser } from "@/lib/session";
import { getCommunityForViewer } from "@/server/communities";

export const metadata: Metadata = { title: "Share · LearnHub" };

export default async function NewPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  if (!role) redirect(`/c/${slug}`);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Link href={`/c/${slug}`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← {community.name}
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Share something</h1>
      <NewPostForm communitySlug={slug} />
    </div>
  );
}
