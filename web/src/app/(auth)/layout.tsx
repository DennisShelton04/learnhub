import { GraduationCap } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-accent px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-xl bg-main p-8 shadow-2xl">
        <Link href="/" className="flex items-center justify-center gap-2 text-lg font-bold text-accent">
          <GraduationCap className="h-6 w-6" /> LearnHub
        </Link>
        {children}
      </div>
    </main>
  );
}
