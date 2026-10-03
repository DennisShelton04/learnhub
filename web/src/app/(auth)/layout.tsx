import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-4">
      <Link href="/" className="text-lg font-semibold">
        LearnHub
      </Link>
      {children}
    </main>
  );
}
