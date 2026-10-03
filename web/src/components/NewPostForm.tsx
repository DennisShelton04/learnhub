"use client";

import { useActionState, useState } from "react";
import { buttonStyles, inputStyles } from "@/components/styles";
import { createPost, type CreatePostState } from "@/server/post-actions";

type PostType = "video" | "article" | "note";

const types: { value: PostType; label: string; hint: string }[] = [
  { value: "video", label: "Video", hint: "Paste a YouTube link" },
  { value: "article", label: "Article", hint: "Paste a link to any article or page" },
  { value: "note", label: "Note", hint: "Write your own explanation or question" },
];

export function NewPostForm({ communitySlug }: { communitySlug: string }) {
  const [state, action, pending] = useActionState<CreatePostState, FormData>(
    createPost.bind(null, communitySlug),
    {},
  );
  const values = state.values ?? {};
  const [type, setType] = useState<PostType>((values.type as PostType) || "video");
  const isLink = type !== "note";

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* The type is submitted via a hidden input: React resets forms after an action,
          which would otherwise revert a radio group behind the visible selection. */}
      <input type="hidden" name="type" value={type} />
      <div className="flex flex-col gap-2">
        <p id="post-type-label" className="mb-1 text-sm font-medium">
          What are you sharing?
        </p>
        <div role="group" aria-labelledby="post-type-label" className="grid grid-cols-3 gap-2">
          {types.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
              className={`rounded-md border px-3 py-2 text-center text-sm font-medium ${
                type === t.value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-zinc-500">{types.find((t) => t.value === type)!.hint}</p>
      </div>

      {isLink && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Link
          <input
            key={type}
            name="url"
            type="url"
            required
            defaultValue={values.url}
            placeholder={type === "video" ? "https://www.youtube.com/watch?v=…" : "https://…"}
            className={inputStyles}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        <span>
          Title {isLink && <span className="font-normal text-zinc-500">(optional — we&apos;ll use the page title)</span>}
        </span>
        <input name="title" required={!isLink} maxLength={200} defaultValue={values.title} className={inputStyles} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        <span>
          {isLink ? "Why is this worth learning from?" : "Your note"}{" "}
          {isLink && <span className="font-normal text-zinc-500">(optional)</span>}
        </span>
        <textarea
          name="body"
          required={!isLink}
          maxLength={5000}
          rows={isLink ? 3 : 8}
          defaultValue={values.body}
          className={inputStyles}
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${buttonStyles.primary} self-start`}>
        {pending ? "Sharing…" : "Share"}
      </button>
    </form>
  );
}
