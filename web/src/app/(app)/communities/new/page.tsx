import type { Metadata } from "next";
import { CreateCommunityForm } from "@/components/CreateCommunityForm";

export const metadata: Metadata = { title: "Create community · LearnHub" };

export default function NewCommunityPage() {
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Create a community</h1>
      <CreateCommunityForm />
    </div>
  );
}
