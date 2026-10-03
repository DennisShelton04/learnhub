"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{error.message}</p>
      <button onClick={reset} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
        Try again
      </button>
    </div>
  );
}
