import { FileText, GraduationCap, MessagesSquare, Video } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/components/styles";

const features = [
  { Icon: Video, title: "Share what you learn", text: "Post YouTube videos, articles and notes into your community." },
  { Icon: MessagesSquare, title: "Discuss it live", text: "Every post gets its own channel with real-time chat." },
  { Icon: FileText, title: "Quiz each other", text: "Test what you learned together — coming soon." },
];

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-rail">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2 text-lg font-bold">
          <GraduationCap className="h-6 w-6 text-accent" /> LearnHub
        </span>
        <Link href="/login" className={`${buttonStyles.secondary} rounded-full`}>
          Log in
        </Link>
      </header>
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-4 py-12">
        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">Learning is better together.</h1>
        <p className="max-w-xl text-lg text-muted">
          Join communities, share videos and articles, discuss them live, and quiz each other to learn faster.
        </p>
        <div>
          <Link href="/signup" className={`${buttonStyles.primary} rounded-full px-6 py-3 text-base`}>
            Get started — it&apos;s free
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {features.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-xl bg-main p-5">
              <Icon className="h-6 w-6 text-accent" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
