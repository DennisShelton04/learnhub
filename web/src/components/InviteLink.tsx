"use client";

import { useState } from "react";
import { buttonStyles, inputStyles } from "@/components/styles";

export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex gap-2">
      <input readOnly value={url} aria-label="Invite link" className={`${inputStyles} min-w-0 flex-1 text-sm`} onFocus={(e) => e.target.select()} />
      <button type="button" onClick={copy} className={buttonStyles.secondary}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
