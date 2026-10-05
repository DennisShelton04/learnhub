"use client";

import { Flag } from "lucide-react";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { buttonStyles, inputStyles } from "@/components/styles";
import { reportContent } from "@/server/report-actions";

const reasons = [
  { value: "spam", label: "Spam or advertising" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "misinformation", label: "Wrong or misleading information" },
  { value: "other", label: "Something else" },
] as const;

type Props = { targetType: "post" | "message" | "quiz"; targetId: string; variant?: "icon" | "text" };

export function ReportButton({ targetType, targetId, variant = "text" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reasons)[number]["value"]>("spam");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<{ error?: string; ok?: true } | null>(null);
  const [pending, startTransition] = useTransition();

  function open(e: React.MouseEvent) {
    e.stopPropagation();
    setResult(null);
    setIsOpen(true);
  }
  const close = () => setIsOpen(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => setResult(await reportContent({ targetType, targetId, reason, details })));
  }

  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={open} aria-label={`Report ${targetType}`} title="Report" className="p-1.5 text-muted hover:bg-hover hover:text-fg">
          <Flag className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-subtle hover:bg-hover hover:text-fg"
        >
          <Flag className="h-4 w-4" />
          <span className="hidden sm:inline">Report</span>
        </button>
      )}
      {/* Portalled to <body> so it isn't affected by the (sometimes hidden) toolbar it's opened from. */}
      {isOpen &&
        createPortal(
          <dialog
            ref={(el) => {
              if (el && !el.open) el.showModal();
            }}
            onClose={close}
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) close(); // click on backdrop
            }}
            aria-labelledby={`report-title-${targetId}`}
            className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-main p-0 text-fg shadow-2xl backdrop:bg-black/60"
          >
            {result?.ok ? (
              <div className="flex flex-col gap-4 p-6">
                <h2 id={`report-title-${targetId}`} className="text-lg font-bold">
                  Thanks for reporting
                </h2>
                <p className="text-muted">The community&apos;s moderators will review this {targetType}.</p>
                <button type="button" onClick={close} className={`${buttonStyles.primary} self-end`}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4 p-6">
                <h2 id={`report-title-${targetId}`} className="text-lg font-bold">
                  Report this {targetType}
                </h2>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm text-muted">What&apos;s wrong with it?</legend>
                  {reasons.map((r) => (
                    <label key={r.value} className="flex cursor-pointer items-center gap-2 rounded-md bg-sidebar px-3 py-2 text-sm hover:bg-hover">
                      <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-accent" />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <label className="flex flex-col gap-1 text-sm">
                  <span>
                    Details <span className="text-subtle">(optional)</span>
                  </span>
                  <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} className={inputStyles} />
                </label>
                {result?.error && (
                  <p role="alert" className="text-sm text-danger">
                    {result.error}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className={buttonStyles.secondary}>
                    Cancel
                  </button>
                  <button type="submit" disabled={pending} className={buttonStyles.danger}>
                    {pending ? "Sending…" : "Report"}
                  </button>
                </div>
              </form>
            )}
          </dialog>,
          document.body,
        )}
    </>
  );
}
