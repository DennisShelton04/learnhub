"use client";

import { buttonStyles } from "@/components/styles";

export function ErrorView({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted">{error.message}</p>
      <button onClick={reset} className={buttonStyles.secondary}>
        Try again
      </button>
    </div>
  );
}
