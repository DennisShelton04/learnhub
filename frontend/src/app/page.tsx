import { BackendStatus } from "@/components/BackendStatus";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">LearnHub</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Learn together: discuss videos and articles, share voice notes, and quiz each other.
      </p>
      <BackendStatus />
    </main>
  );
}
