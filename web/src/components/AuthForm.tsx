"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { buttonStyles, inputStyles } from "@/components/styles";
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
      <h1 className="text-center text-2xl font-bold">
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
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !hydrated}
        className={`${buttonStyles.primary} py-2.5`}
      >
        {pending ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
      </button>

      <p className="text-sm text-muted">
        {isSignup ? "Already have an account? " : "New to LearnHub? "}
        <Link href={otherHref} className="font-medium text-accent hover:underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
      {label}
      <input
        required
        {...props}
        className={`${inputStyles} font-normal`}
      />
    </label>
  );
}
