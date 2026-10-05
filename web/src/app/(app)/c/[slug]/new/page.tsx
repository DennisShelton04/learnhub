import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewPostForm, type PostType } from "@/components/NewPostForm";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { requireUser } from "@/lib/session";
import { getCommunityForViewer } from "@/server/communities";

export const metadata: Metadata = { title: "Share · LearnHub" };

const postTypes: PostType[] = ["video", "article", "note"];

export default async function NewPostPage({ params, searchParams }: PageProps<"/c/[slug]/new">) {
  const { slug } = await params;
  const { type } = await searchParams;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  if (!role) redirect(`/c/${slug}`);
  const initialType = postTypes.find((t) => t === type) ?? "video";

  return (
    <>
      <ChannelHeader icon={<Plus className="h-5 w-5" />} title="Share something" />
      <PageBody width="max-w-xl">
        <div>
          <h2 className="text-2xl font-bold">Share with {community.name}</h2>
          <p className="mt-1 text-muted">Everything you share gets its own channel for discussion.</p>
        </div>
        <NewPostForm communitySlug={slug} initialType={initialType} />
      </PageBody>
    </>
  );
}
