"use client";

import { Check, RotateCcw, Trophy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonStyles } from "@/components/styles";
import { answerQuestion, finishAttempt, startAttempt } from "@/server/quiz-actions";
import type { PlayableQuestion } from "@/server/quizzes";

type Feedback = { chosen: string; correct: boolean; correctOptionId: string; explanation: string };

type State =
  | { phase: "intro" }
  | { phase: "playing"; attemptId: string; questions: PlayableQuestion[]; index: number; score: number; feedback: Feedback | null }
  | { phase: "done"; score: number; total: number; xpEarned: number };

export function QuizRunner({ quizId, questionCount, canPlay }: { quizId: string; questionCount: number; canPlay: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "intro" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startAttempt(quizId);
      if ("error" in result) setError(result.error);
      else setState({ phase: "playing", attemptId: result.attemptId, questions: result.questions, index: 0, score: 0, feedback: null });
    });
  }

  function choose(optionId: string) {
    if (state.phase !== "playing" || state.feedback || pending) return;
    const question = state.questions[state.index];
    startTransition(async () => {
      const result = await answerQuestion(state.attemptId, question.id, optionId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setState({ ...state, score: state.score + (result.correct ? 1 : 0), feedback: { chosen: optionId, ...result } });
    });
  }

  function next() {
    if (state.phase !== "playing") return;
    if (state.index + 1 < state.questions.length) {
      setState({ ...state, index: state.index + 1, feedback: null });
      return;
    }
    startTransition(async () => {
      const result = await finishAttempt(state.attemptId);
      if ("error" in result) setError(result.error);
      else {
        setState({ phase: "done", ...result });
        router.refresh(); // update the leaderboard
      }
    });
  }

  if (state.phase === "intro") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl bg-sidebar p-6">
        <p className="text-muted">
          {questionCount} {questionCount === 1 ? "question" : "questions"} · instant feedback after each answer
        </p>
        {canPlay ? (
          <button onClick={start} disabled={pending} className={buttonStyles.primary}>
            {pending ? "Starting…" : "Start quiz"}
          </button>
        ) : (
          <p className="text-sm text-subtle">Join this community to take the quiz.</p>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  if (state.phase === "done") {
    const pct = state.total ? Math.round((state.score / state.total) * 100) : 0;
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-sidebar p-8 text-center">
        <Trophy className={`h-12 w-12 ${pct >= 80 ? "text-amber-400" : "text-subtle"}`} />
        <h3 className="text-2xl font-bold">
          {state.score} / {state.total}
        </h3>
        {state.xpEarned > 0 && (
          <p className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">+{state.xpEarned} XP</p>
        )}
        <p className="text-muted">{pct >= 80 ? "Excellent work! 🎉" : pct >= 50 ? "Nice — review the explanations and try again." : "Keep going — every attempt helps you learn."}</p>
        <button onClick={() => setState({ phase: "intro" })} className={buttonStyles.secondary}>
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  const question = state.questions[state.index];
  const fb = state.feedback;
  const last = state.index + 1 === state.questions.length;

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-sidebar p-6">
      <div className="flex items-center justify-between text-sm text-subtle">
        <span>
          Question {state.index + 1} of {state.questions.length}
        </span>
        <span>Score: {state.score}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-selected">
        <div className="h-full bg-accent transition-all" style={{ width: `${((state.index + (fb ? 1 : 0)) / state.questions.length) * 100}%` }} />
      </div>
      <h3 className="whitespace-pre-line text-lg font-semibold">{question.prompt}</h3>
      <div className="flex flex-col gap-2" role="group" aria-label="Answers">
        {question.options.map((o) => {
          const isCorrect = fb && o.id === fb.correctOptionId;
          const isWrongChoice = fb && o.id === fb.chosen && !fb.correct;
          return (
            <button
              key={o.id}
              onClick={() => choose(o.id)}
              disabled={!!fb || pending}
              className={`flex items-center justify-between gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                isCorrect
                  ? "border-success bg-success/15"
                  : isWrongChoice
                    ? "border-danger bg-danger/15"
                    : fb
                      ? "border-transparent bg-main opacity-60"
                      : "border-transparent bg-main hover:border-accent"
              }`}
            >
              <span>{o.text}</span>
              {isCorrect && <Check className="h-5 w-5 shrink-0 text-success" aria-label="Correct answer" />}
              {isWrongChoice && <X className="h-5 w-5 shrink-0 text-danger" aria-label="Your answer" />}
            </button>
          );
        })}
      </div>

      {fb && (
        <div aria-live="polite" className={`rounded-lg px-4 py-3 ${fb.correct ? "bg-success/15" : "bg-danger/15"}`}>
          <p className="font-semibold">{fb.correct ? "Correct!" : "Not quite."}</p>
          {fb.explanation && <p className="mt-1 text-sm text-muted">{fb.explanation}</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {fb && (
        <button onClick={next} disabled={pending} className={`${buttonStyles.primary} self-end`}>
          {last ? (pending ? "Finishing…" : "See results") : "Next question"}
        </button>
      )}
    </div>
  );
}
