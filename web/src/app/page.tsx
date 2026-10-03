import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-4">
      <h1 className="text-4xl font-semibold tracking-tight">LearnHub</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Learn together: discuss videos and articles, share voice notes, and quiz each other.
      </p>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
