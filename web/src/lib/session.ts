import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

// Cached per request so layouts and pages can both call it cheaply.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
