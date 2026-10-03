import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold">
            LearnHub
          </Link>
          <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Home
            </Link>
            <Link href="/communities" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Communities
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-zinc-600 sm:inline dark:text-zinc-400">{user.name}</span>
            <SignOutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
