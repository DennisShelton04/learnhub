"use client";

import { Check, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { buttonStyles, inputStyles } from "@/components/styles";
import { createQuiz, type QuizDraft } from "@/server/quiz-actions";

type DraftQuestion = { key: number; prompt: string; explanation: string; options: string[]; correctIndex: number };

let nextKey = 1;
const blankQuestion = (): DraftQuestion => ({ key: nextKey++, prompt: "", explanation: "", options: ["", ""], correctIndex: 0 });

export function QuizBuilder({
  communitySlug,
  posts,
  initialPostId,
}: {
  communitySlug: string;
  posts: { id: string; title: string }[];
  initialPostId: string | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [postId, setPostId] = useState(initialPostId ?? "");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => [blankQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: number, change: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...change } : q)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const draft: QuizDraft = {
      title,
      description,
      postId: postId || null,
      questions: questions.map(({ prompt, explanation, options, correctIndex }) => ({ prompt, explanation, options, correctIndex })),
    };
    startTransition(async () => {
      const result = await createQuiz(communitySlug, draft);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Quiz title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} className={inputStyles} placeholder="e.g. Closures — check your understanding" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <span>
            Description <span className="font-normal text-subtle">(optional)</span>
          </span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className={inputStyles} />
        </label>
        {posts.length > 0 && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>
              About which post? <span className="font-normal text-subtle">(optional)</span>
            </span>
            <select value={postId} onChange={(e) => setPostId(e.target.value)} className={inputStyles}>
              <option value="">Not linked to a post</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <ol className="flex flex-col gap-4">
        {questions.map((q, qi) => (
          <li key={q.key} className="flex flex-col gap-3 rounded-lg bg-sidebar p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Question {qi + 1}</h3>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                  aria-label={`Remove question ${qi + 1}`}
                  className="rounded p-1 text-subtle hover:bg-hover hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <textarea
              value={q.prompt}
              onChange={(e) => update(q.key, { prompt: e.target.value })}
              required
              maxLength={500}
              rows={2}
              aria-label={`Question ${qi + 1}`}
              placeholder="What do you want to ask?"
              className={inputStyles}
            />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs text-subtle">Answers — tick the correct one</legend>
              {q.options.map((opt, oi) => {
                const correct = q.correctIndex === oi;
                return (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => update(q.key, { correctIndex: oi })}
                      aria-label={`Mark answer ${oi + 1} as correct`}
                      aria-pressed={correct}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                        correct ? "border-success bg-success text-white" : "border-selected text-transparent hover:border-success"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <input
                      value={opt}
                      onChange={(e) => update(q.key, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
                      required
                      maxLength={200}
                      aria-label={`Question ${qi + 1}, answer ${oi + 1}`}
                      placeholder={`Answer ${oi + 1}`}
                      className={`${inputStyles} min-w-0 flex-1 py-1.5 text-sm`}
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          update(q.key, {
                            options: q.options.filter((_, i) => i !== oi),
                            correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex,
                          })
                        }
                        aria-label={`Remove answer ${oi + 1}`}
                        className="rounded p-1 text-subtle hover:text-danger"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {q.options.length < 6 && (
                <button
                  type="button"
                  onClick={() => update(q.key, { options: [...q.options, ""] })}
                  className="self-start text-sm text-accent hover:underline"
                >
                  + Add answer
                </button>
              )}
            </fieldset>

            <input
              value={q.explanation}
              onChange={(e) => update(q.key, { explanation: e.target.value })}
              maxLength={1000}
              aria-label={`Question ${qi + 1} explanation`}
              placeholder="Explanation shown after answering (optional)"
              className={`${inputStyles} text-sm`}
            />
          </li>
        ))}
      </ol>

      {questions.length < 50 && (
        <button type="button" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])} className={`${buttonStyles.secondary} self-start`}>
          <Plus className="h-4 w-4" /> Add question
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${buttonStyles.primary} self-start`}>
        {pending ? "Creating…" : `Create quiz (${questions.length} ${questions.length === 1 ? "question" : "questions"})`}
      </button>
    </form>
  );
}
