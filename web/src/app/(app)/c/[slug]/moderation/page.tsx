import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody } from "@/components/shell/AppNav";
import { ChannelHeader } from "@/components/shell/ChannelHeader";
import { buttonStyles } from "@/components/styles";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { canManageMembers, getCommunityForViewer } from "@/server/communities";
import { getModerationQueue } from "@/server/moderation";
import { resolveReports } from "@/server/report-actions";

export const metadata: Metadata = { title: "Moderation · LearnHub" };

const reasonLabel: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate: "Inappropriate",
  misinformation: "Misinformation",
  other: "Other",
};

export default async function ModerationPage({ params }: PageProps<"/c/[slug]/moderation">) {
  const { slug } = await params;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  if (!canManageMembers(role)) notFound();
  const queue = await getModerationQueue(community.id);

  return (
    <>
      <ChannelHeader icon={<ShieldAlert className="h-5 w-5" />} title="moderation" />
      <PageBody width="max-w-3xl">
        <div>
          <h2 className="text-2xl font-bold">Reports to review</h2>
          <p className="mt-1 text-muted">Remove content that breaks the community&apos;s rules, or dismiss reports that don&apos;t.</p>
        </div>
        {queue.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-6 text-muted">All clear — no open reports. 🎉</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((item) => {
              const resolve = (decision: "removed" | "dismissed") =>
                resolveReports.bind(null, community.id, item.targetType, item.targetId, decision);
              return (
                <li key={`${item.targetType}:${item.targetId}`} className="flex flex-col gap-3 rounded-lg bg-sidebar p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-danger/15 px-2 py-0.5 font-semibold text-danger">
                      {item.reports} {item.reports === 1 ? "report" : "reports"}
                    </span>
                    <span className="rounded bg-hover px-2 py-0.5 font-medium capitalize">{item.targetType}</span>
                    {item.reasons.map((r) => (
                      <span key={r} className="rounded bg-hover px-2 py-0.5">
                        {reasonLabel[r] ?? r}
                      </span>
                    ))}
                    {item.firstReportedAt && <span className="text-subtle">first reported {timeAgo(item.firstReportedAt)}</span>}
                  </div>
                  {item.target ? (
                    <div className="rounded-md bg-main p-3">
                      <p className="text-xs text-subtle">by {item.target.authorName}</p>
                      <p className="line-clamp-4 whitespace-pre-line">{item.target.preview}</p>
                      <Link href={item.target.href} className="mt-1 inline-block text-sm text-accent hover:underline">
                        View in context →
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm italic text-subtle">This content has already been deleted.</p>
                  )}
                  {item.details.length > 0 && (
                    <ul className="flex flex-col gap-1 text-sm text-muted">
                      {item.details.map((d, i) => (
                        <li key={i}>“{d}”</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    {item.target && (
                      <form action={resolve("removed")}>
                        <button className={buttonStyles.danger}>Remove {item.targetType}</button>
                      </form>
                    )}
                    <form action={resolve("dismissed")}>
                      <button className={buttonStyles.secondary}>{item.target ? "Dismiss" : "Close"}</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </>
  );
}
