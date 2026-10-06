"use client";

import { Check, Crown, Swords, Users, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { InviteLink } from "@/components/InviteLink";
import { subscribeLive } from "@/lib/live";
import { buttonStyles } from "@/components/styles";
import { advanceBattle, answerBattle, expireQuestion, joinBattle } from "@/server/battle-actions";
import type { BattleState } from "@/server/battles";

// Kahoot-style answer colours (with shapes so colour isn't the only cue).
const answerStyles = [
  { bg: "bg-[#e21b3c]", shape: "▲" },
  { bg: "bg-[#1368ce]", shape: "◆" },
  { bg: "bg-[#d89e00]", shape: "●" },
  { bg: "bg-[#26890c]", shape: "■" },
  { bg: "bg-[#864cbf]", shape: "★" },
  { bg: "bg-[#0aa3a3]", shape: "✚" },
];

export function BattleRoom({ initial, slug, inviteUrl }: { initial: BattleState; slug: string; inviteUrl: string }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Server clock minus local clock, so countdowns agree across devices.
  const clockOffset = useRef(0);
  useEffect(() => {
    clockOffset.current = Date.parse(initial.serverNow) - Date.now();
  }, [initial.serverNow]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/battles/${initial.id}/state`, { cache: "no-store" });
    if (!res.ok) return;
    const next = (await res.json()) as BattleState;
    clockOffset.current = Date.parse(next.serverNow) - Date.now();
    setState(next);
  }, [initial.id]);

  useEffect(() => {
    return subscribeLive(`/api/battles/${initial.id}/events`, {
      types: ["battle.updated"],
      onEvent: () => void refresh(),
    });
  }, [initial.id, refresh]);

  const run = (fn: () => Promise<{ error?: string } | void>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      await refresh();
    });
  };

  const host = state.players.find((p) => p.userId === state.hostId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-full bg-danger px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> {state.status === "finished" ? "Finished" : "Live"}
        </span>
        <span className="text-sm text-muted">
          Hosted by {host?.name ?? "the host"} · {state.players.length} {state.players.length === 1 ? "player" : "players"}
        </span>
        {state.status !== "lobby" && state.status !== "finished" && (
          <span className="ml-auto text-sm font-medium text-muted">
            Question {state.index + 1} of {state.total}
          </span>
        )}
      </div>

      {state.status === "lobby" && <Lobby state={state} inviteUrl={inviteUrl} pending={pending} run={run} />}
      {state.status === "question" && state.question && (
        <QuestionView state={state} clockOffset={clockOffset} pending={pending} run={run} />
      )}
      {state.status === "reveal" && state.question && <RevealView state={state} pending={pending} run={run} />}
      {state.status === "finished" && <Podium state={state} slug={slug} />}

      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type ViewProps = { state: BattleState; pending: boolean; run: (fn: () => Promise<{ error?: string } | void>) => void };

function Lobby({ state, inviteUrl, pending, run }: ViewProps & { inviteUrl: string }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-3 rounded-xl bg-accent px-6 py-10 text-center text-white">
        <Swords className="h-10 w-10" />
        <h2 className="text-2xl font-bold">{state.quizTitle}</h2>
        <p className="text-white/80">
          {state.total} questions · {state.secondsPerQuestion}s each · faster correct answers score more
        </p>
        {state.isHost ? (
          <button
            onClick={() => run(() => advanceBattle(state.id))}
            disabled={pending || state.total === 0}
            className="mt-2 rounded-full bg-white px-8 py-3 text-lg font-bold text-accent hover:bg-white/90 disabled:opacity-60"
          >
            Start battle
          </button>
        ) : state.canJoin ? (
          <button
            onClick={() => run(() => joinBattle(state.id))}
            disabled={pending}
            className="mt-2 rounded-full bg-white px-8 py-3 text-lg font-bold text-accent hover:bg-white/90 disabled:opacity-60"
          >
            Join battle
          </button>
        ) : state.isPlayer ? (
          <p className="mt-2 font-semibold">You&apos;re in! Waiting for the host to start…</p>
        ) : (
          <p className="mt-2 font-semibold">Join the community to play.</p>
        )}
      </section>
      {state.isHost && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Invite players</h3>
          <InviteLink url={inviteUrl} />
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
          <Users className="h-4 w-4" /> Players — {state.players.length}
        </h3>
        <ul className="flex flex-wrap gap-2" aria-live="polite">
          {state.players.map((p) => (
            <li key={p.userId} className="flex items-center gap-2 rounded-full bg-sidebar py-1 pl-1 pr-3 text-sm font-medium">
              <Avatar name={p.name} seed={p.userId} size="sm" />
              {p.name}
              {p.userId === state.hostId && <Crown className="h-4 w-4 text-amber-400" aria-label="Host" />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Countdown({ deadline, seconds, clockOffset, onExpire }: { deadline: string; seconds: number; clockOffset: React.RefObject<number>; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, Date.parse(deadline) - (now + clockOffset.current));
  const timeUp = remaining === 0;
  // The server keeps answers open for a short grace period after the deadline, so ask it to
  // close the question just after that, and keep asking until it does (this view then unmounts).
  useEffect(() => {
    if (!timeUp) return;
    const first = setTimeout(onExpire, 1500);
    const retry = setInterval(onExpire, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(retry);
    };
  }, [timeUp, onExpire]);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-selected">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${remaining < 5000 ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${(remaining / (seconds * 1000)) * 100}%` }}
        />
      </div>
      <span className="w-8 text-right text-lg font-bold tabular-nums" aria-label="Seconds left">
        {Math.ceil(remaining / 1000)}
      </span>
    </div>
  );
}

function QuestionView({ state, clockOffset, pending, run }: ViewProps & { clockOffset: React.RefObject<number> }) {
  const q = state.question!;
  const answered = state.myAnswer?.optionId;
  const onExpire = useCallback(() => run(() => expireQuestion(state.id)), [run, state.id]);

  return (
    <div className="flex flex-col gap-5">
      <Countdown deadline={state.deadline!} seconds={state.secondsPerQuestion} clockOffset={clockOffset} onExpire={onExpire} />
      <h2 className="rounded-xl bg-sidebar px-6 py-8 text-center text-2xl font-bold">{q.prompt}</h2>
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Answers">
        {q.options.map((o, i) => {
          const style = answerStyles[i % answerStyles.length];
          const chosen = answered === o.id;
          return (
            <button
              key={o.id}
              onClick={() => run(() => answerBattle(state.id, o.id))}
              disabled={!state.isPlayer || !!answered || pending}
              aria-pressed={chosen}
              className={`flex min-h-20 items-center gap-3 rounded-xl px-5 py-4 text-left text-lg font-semibold text-white shadow transition ${style.bg} ${
                answered && !chosen ? "opacity-40" : ""
              } ${chosen ? "ring-4 ring-fg/40" : ""} enabled:hover:brightness-110 disabled:cursor-default`}
            >
              <span aria-hidden className="text-2xl">
                {style.shape}
              </span>
              {o.text}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span aria-live="polite">
          {!state.isPlayer
            ? "You're watching this battle."
            : answered
              ? "Answer locked in — waiting for the others…"
              : "Pick an answer before the time runs out!"}{" "}
          ({state.answeredCount}/{state.players.length} answered)
        </span>
        {state.isHost && (
          <button onClick={() => run(() => advanceBattle(state.id))} disabled={pending} className={buttonStyles.secondary}>
            Reveal answer now
          </button>
        )}
      </div>
    </div>
  );
}

function RevealView({ state, pending, run }: ViewProps) {
  const q = state.question!;
  const counts = state.answerCounts ?? {};
  const max = Math.max(1, ...Object.values(counts));
  const mine = state.myAnswer;
  const last = state.index + 1 >= state.total;

  return (
    <div className="flex flex-col gap-5">
      {state.isPlayer && (
        <div aria-live="polite" className={`rounded-xl px-6 py-4 text-center text-white ${mine?.correct ? "bg-success" : "bg-danger"}`}>
          <p className="text-xl font-bold">{mine ? (mine.correct ? "Correct!" : "Not this time") : "Time's up!"}</p>
          {mine?.correct && <p className="text-white/90">+{mine.points} points</p>}
        </div>
      )}
      <h2 className="text-center text-xl font-bold">{q.prompt}</h2>
      <ul className="flex flex-col gap-2">
        {q.options.map((o, i) => {
          const correct = o.id === state.correctOptionId;
          const n = counts[o.id] ?? 0;
          return (
            <li key={o.id} className={`flex items-center gap-3 rounded-lg px-4 py-3 ${correct ? "bg-success/15 ring-2 ring-success" : "bg-sidebar"}`}>
              <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-white ${answerStyles[i % answerStyles.length].bg}`}>
                {answerStyles[i % answerStyles.length].shape}
              </span>
              <span className="min-w-0 flex-1 font-medium">{o.text}</span>
              {correct ? <Check className="h-5 w-5 text-success" aria-label="Correct answer" /> : mine?.optionId === o.id && <X className="h-5 w-5 text-danger" aria-label="Your answer" />}
              <span className="flex w-28 items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-selected">
                  <span className="block h-full bg-accent" style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span className="w-5 text-right text-sm tabular-nums">{n}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {state.explanation && <p className="rounded-lg bg-sidebar px-4 py-3 text-sm text-muted">{state.explanation}</p>}
      <Scoreboard players={state.players.slice(0, 5)} />
      {state.isHost ? (
        <button onClick={() => run(() => advanceBattle(state.id))} disabled={pending} className={`${buttonStyles.primary} self-center px-8 py-3 text-base`}>
          {last ? "Show final results" : "Next question"}
        </button>
      ) : (
        <p className="text-center text-sm text-subtle">Waiting for the host to continue…</p>
      )}
    </div>
  );
}

function Scoreboard({ players }: { players: BattleState["players"] }) {
  return (
    <ol className="flex flex-col rounded-lg bg-sidebar p-1" aria-label="Scoreboard">
      {players.map((p, i) => (
        <li key={p.userId} className="flex items-center gap-3 rounded px-3 py-2">
          <span className="w-5 text-center text-sm font-bold text-subtle">{i + 1}</span>
          <Avatar name={p.name} seed={p.userId} size="sm" />
          <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
          <span className="font-bold tabular-nums">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

function Podium({ state, slug }: { state: BattleState; slug: string }) {
  const [first, second, third] = state.players;
  const step = (p: (typeof state.players)[number] | undefined, place: number, height: string, color: string) =>
    p && (
      <div className="flex w-28 flex-col items-center gap-2">
        <Avatar name={p.name} seed={p.userId} />
        <span className="max-w-full truncate text-sm font-semibold">{p.name}</span>
        <span className="text-xs tabular-nums text-subtle">{p.score} pts</span>
        <div className={`flex w-full items-start justify-center rounded-t-lg pt-2 text-2xl font-black text-white ${height} ${color}`}>{place}</div>
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-center text-2xl font-bold">🏆 {first ? `${first.name} wins!` : "Battle over"}</h2>
      <div className="flex items-end justify-center gap-2">
        {step(second, 2, "h-20", "bg-zinc-400")}
        {step(first, 1, "h-28", "bg-amber-400")}
        {step(third, 3, "h-14", "bg-orange-500")}
      </div>
      <Scoreboard players={state.players} />
      <Link href={`/c/${slug}/q/${state.quizId}`} className={`${buttonStyles.secondary} self-center`}>
        Back to the quiz
      </Link>
    </div>
  );
}
