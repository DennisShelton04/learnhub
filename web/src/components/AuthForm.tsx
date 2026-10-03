"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";

type Mode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // False during server render and until hydration, so the form can't be submitted natively.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const { error } =
      mode === "signup"
        ? await authClient.signUp.email({ name: String(form.get("name")), email, password })
        : await authClient.signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      return;
    }
    router.push(safeNext(next));
    router.refresh();
  }

  const isSignup = mode === "signup";
  const otherHref = (isSignup ? "/login" : "/signup") + (next ? `?next=${encodeURIComponent(next)}` : "");

  // method="post": if submitted before JS loads, never put credentials in the URL.
  return (
    <form method="post" onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>

      {isSignup && <Field label="Name" name="name" type="text" autoComplete="name" />}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={isSignup ? "new-password" : "current-password"}
        minLength={8}
      />

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !hydrated}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
      </button>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {isSignup ? "Already have an account? " : "New to LearnHub? "}
        <Link href={otherHref} className="font-medium underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        required
        {...props}
        className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base font-normal outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
      />
    </label>
  );
}
