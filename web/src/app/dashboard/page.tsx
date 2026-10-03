import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard · LearnHub" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">LearnHub</span>
        <SignOutButton />
      </header>
      <h1 className="text-3xl font-semibold tracking-tight">Hi, {session.user.name} 👋</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        You&apos;re signed in as {session.user.email}. Communities are coming next.
      </p>
    </main>
  );
}
