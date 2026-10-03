import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign up · LearnHub" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
