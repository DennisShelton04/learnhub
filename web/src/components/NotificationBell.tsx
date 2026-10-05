"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/notifications/count", { cache: "no-store" });
    if (res.ok) setUnread((await res.json()).unread);
  }, []);

  useEffect(() => {
    const events = new EventSource("/api/notifications/events");
    events.addEventListener("ready", refresh);
    events.addEventListener("notifications.changed", refresh);
    return () => events.close();
  }, [refresh]);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      title="Notifications"
      className="relative rounded p-1.5 text-muted hover:bg-hover hover:text-fg"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
