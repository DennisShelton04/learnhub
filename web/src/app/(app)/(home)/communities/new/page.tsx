import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { CreateCommunityForm } from "@/components/CreateCommunityForm";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";

export const metadata: Metadata = { title: "Create community · LearnHub" };

export default function NewCommunityPage() {
  return (
    <>
      <ChannelHeader icon={<Plus className="h-5 w-5" />} title="Create a community" />
      <PageBody width="max-w-lg">
        <div>
          <h2 className="text-2xl font-bold">Create your community</h2>
          <p className="mt-1 text-muted">A place for people to share, discuss and quiz each other on a topic.</p>
        </div>
        <CreateCommunityForm />
      </PageBody>
    </>
  );
}
