import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuizBuilder } from "@/components/QuizBuilder";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { requireUser } from "@/lib/session";
import { getCommunityForViewer } from "@/server/communities";
import { listCommunityPosts } from "@/server/posts";

export const metadata: Metadata = { title: "Create quiz · LearnHub" };

export default async function NewQuizPage({ params, searchParams }: PageProps<"/c/[slug]/quizzes/new">) {
  const { slug } = await params;
  const { post } = await searchParams;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  if (!role) redirect(`/c/${slug}`);
  const posts = (await listCommunityPosts(community.id)).map((p) => ({ id: p.id, title: p.title }));
  const initialPostId = typeof post === "string" && posts.some((p) => p.id === post) ? post : null;

  return (
    <>
      <ChannelHeader icon={<ListChecks className="h-5 w-5" />} title="Create a quiz" />
      <PageBody width="max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold">Create a quiz</h2>
          <p className="mt-1 text-muted">Help {community.name} learn faster — members get instant feedback on each answer.</p>
        </div>
        <QuizBuilder communitySlug={slug} posts={posts} initialPostId={initialPostId} />
      </PageBody>
    </>
  );
}
