"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type Status = "checking" | "ok" | "down";

export function BackendStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    apiGet<{ status: string }>("/api/health")
      .then((r) => setStatus(r.status === "ok" ? "ok" : "down"))
      .catch(() => setStatus("down"));
  }, []);

  const label = { checking: "Checking backend…", ok: "Backend connected", down: "Backend unreachable" }[status];
  const color = { checking: "bg-zinc-400", ok: "bg-emerald-500", down: "bg-red-500" }[status];

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-800">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
