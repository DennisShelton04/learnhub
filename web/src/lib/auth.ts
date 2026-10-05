import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Extra sites allowed to call the auth API (e.g. a sharing tunnel alongside localhost).
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
