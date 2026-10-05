import { Bell, MessageSquare, Reply, Swords } from "lucide-react";
import type { Metadata } from "next";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { buttonStyles } from "@/components/styles";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { markAllRead, openNotification } from "@/server/notification-actions";
import { listNotifications } from "@/server/notifications";

export const metadata: Metadata = { title: "Notifications · LearnHub" };

const icons = { reply: Reply, post_comment: MessageSquare, battle_started: Swords } as const;

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <ChannelHeader icon={<Bell className="h-5 w-5" />} title="Notifications">
        {unread > 0 && (
          <form action={markAllRead}>
            <button className={`${buttonStyles.secondary} px-3 py-1.5`}>Mark all as read</button>
          </form>
        )}
      </ChannelHeader>
      <PageBody width="max-w-2xl">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-6 text-muted">
            Nothing yet. You&apos;ll hear about replies, comments on your posts and live battles here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((n) => {
              const Icon = icons[n.kind];
              return (
                <li key={n.id}>
                  <form action={openNotification.bind(null, n.id)}>
                    <button
                      className={`flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left hover:bg-hover ${n.readAt ? "" : "bg-accent-soft"}`}
                    >
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${n.readAt ? "text-subtle" : "text-accent"}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block ${n.readAt ? "" : "font-semibold"}`}>{n.title}</span>
                        {n.body && <span className="block truncate text-sm text-muted">{n.body}</span>}
                        <span className="block text-xs text-subtle">{timeAgo(n.createdAt)}</span>
                      </span>
                      {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </>
  );
}
