"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      aria-label="Log out"
      title="Log out"
      className="rounded p-1.5 text-muted hover:bg-hover hover:text-fg"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
