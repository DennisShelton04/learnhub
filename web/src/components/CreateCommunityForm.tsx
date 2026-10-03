"use client";

import { useActionState } from "react";
import { buttonStyles, inputStyles } from "@/components/styles";
import { createCommunity, type CreateCommunityState } from "@/server/community-actions";

export function CreateCommunityForm() {
  const [state, action, pending] = useActionState<CreateCommunityState, FormData>(createCommunity, {});
  const values = state.values ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input name="name" required minLength={3} maxLength={60} defaultValue={values.name} className={inputStyles} placeholder="e.g. JavaScript Beginners" />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Description <span className="font-normal text-zinc-500">(optional)</span>
        <textarea name="description" maxLength={500} rows={4} defaultValue={values.description} className={inputStyles} placeholder="What will members learn and discuss here?" />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Who can join?</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="visibility" value="public" defaultChecked={values.visibility !== "private"} className="mt-1" />
          <span>
            <span className="font-medium">Public</span> — anyone can find and join
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="visibility" value="private" defaultChecked={values.visibility === "private"} className="mt-1" />
          <span>
            <span className="font-medium">Private</span> — hidden; people join with an invite link
          </span>
        </label>
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${buttonStyles.primary} self-start`}>
        {pending ? "Creating…" : "Create community"}
      </button>
    </form>
  );
}
