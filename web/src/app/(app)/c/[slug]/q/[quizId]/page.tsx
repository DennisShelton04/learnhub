import { ListChecks, Medal, Swords, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { QuizRunner } from "@/components/QuizRunner";
import { ReportButton } from "@/components/ReportButton";
import { buttonStyles } from "@/components/styles";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getCommunityForViewer } from "@/server/communities";
import { createBattle } from "@/server/battle-actions";
import { deleteQuiz } from "@/server/quiz-actions";
import { canDeleteQuiz, getLeaderboard, getQuiz, getQuizStats } from "@/server/quizzes";

export const metadata: Metadata = { title: "Quiz · LearnHub" };

const medal = ["text-amber-400", "text-zinc-400", "text-orange-500"];

function formatSeconds(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default async function QuizPage({ params }: PageProps<"/c/[slug]/q/[quizId]">) {
  const { slug, quizId } = await params;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  const quiz = await getQuiz(quizId);
  if (!quiz || quiz.communityId !== community.id) notFound();
  const [leaderboard, stats] = await Promise.all([getLeaderboard(quiz.id), getQuizStats(quiz.id)]);

  return (
    <>
      <ChannelHeader icon={<ListChecks className="h-5 w-5" />} title={quiz.title}>
        {quiz.authorId !== user.id && <ReportButton targetType="quiz" targetId={quiz.id} />}
        {canDeleteQuiz(role, quiz.authorId, user.id) && (
          <form action={deleteQuiz.bind(null, quiz.id)}>
            <ConfirmSubmitButton
              message="Delete this quiz and all its results? This can't be undone."
              className="flex items-center gap-1 rounded px-2 py-1 text-sm text-subtle hover:bg-hover hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete quiz</span>
            </ConfirmSubmitButton>
          </form>
        )}
      </ChannelHeader>
      <PageBody width="max-w-3xl">
        <section className="flex flex-col gap-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-hover">
            <ListChecks className="h-7 w-7" />
          </span>
          <h2 className="text-2xl font-bold">{quiz.title}</h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-subtle">
            <Avatar name={quiz.authorName} seed={quiz.authorId} size="xs" />
            Quiz by <span className="font-medium text-muted">{quiz.authorName}</span> · {timeAgo(quiz.createdAt)} · {stats.players}{" "}
            {stats.players === 1 ? "player" : "players"}
          </p>
          {quiz.postId && quiz.postTitle && (
            <p className="text-sm text-muted">
              About:{" "}
              <Link href={`/c/${slug}/p/${quiz.postId}`} className="font-medium text-accent hover:underline">
                {quiz.postTitle}
              </Link>
            </p>
          )}
          {quiz.description && <p className="whitespace-pre-line text-muted">{quiz.description}</p>}
        </section>

        <QuizRunner quizId={quiz.id} questionCount={quiz.questionCount} canPlay={Boolean(role)} />

        {role && (
          <section className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-dashed border-accent/40 p-5">
            <Swords className="h-8 w-8 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">Play it live with others</h3>
              <p className="text-sm text-muted">Host a timed battle — everyone answers together and the fastest correct answers win.</p>
            </div>
            <form action={createBattle.bind(null, quiz.id)}>
              <button className={buttonStyles.primary}>Host live battle</button>
            </form>
          </section>
        )}

        <section aria-labelledby="leaderboard" className="flex flex-col gap-2">
          <h3 id="leaderboard" className="text-xs font-semibold uppercase tracking-wide text-subtle">
            Leaderboard
          </h3>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-subtle">No one has finished this quiz yet. Be the first!</p>
          ) : (
            <ol className="flex flex-col rounded-lg bg-sidebar p-1">
              {leaderboard.map((row, i) => (
                <li
                  key={row.userId}
                  className={`flex items-center gap-3 rounded px-3 py-2 ${row.userId === user.id ? "bg-accent-soft" : ""}`}
                >
                  <span className="w-6 text-center text-sm font-semibold text-subtle">
                    {i < 3 ? <Medal className={`mx-auto h-5 w-5 ${medal[i]}`} aria-label={`Rank ${i + 1}`} /> : i + 1}
                  </span>
                  <Avatar name={row.name} seed={row.userId} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {row.name}
                    {row.userId === user.id && <span className="font-normal text-subtle"> (you)</span>}
                  </span>
                  <span className="text-sm tabular-nums text-subtle">{formatSeconds(row.seconds)}</span>
                  <span className="w-14 text-right font-semibold tabular-nums">
                    {row.score}/{row.total}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </PageBody>
    </>
  );
}
