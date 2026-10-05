import { DoorOpen, FileText, Hash, Headphones, ListChecks, Lock, Plus, ShieldAlert, StickyNote, Swords, Trophy, Users, Video } from "lucide-react";
import Link from "next/link";
import { AppNav, MainPane } from "@/components/shell/AppNav";
import { Sidebar, SidebarSection } from "@/components/shell/Sidebar";
import { SidebarLink } from "@/components/shell/SidebarLink";
import { buttonStyles } from "@/components/styles";
import { requireUser } from "@/lib/session";
import { canManageMembers, getCommunityForViewer } from "@/server/communities";
import { countOpenReports } from "@/server/moderation";
import { joinCommunity, leaveCommunity } from "@/server/community-actions";
import { listLiveBattles } from "@/server/battles";
import { listCommunityPosts } from "@/server/posts";
import { listCommunityQuizzes } from "@/server/quizzes";
import { listLiveRooms } from "@/server/rooms";

const icon = "h-5 w-5";
const sections = [
  { type: "video", title: "Videos", empty: "No videos yet", Icon: Video },
  { type: "article", title: "Articles", empty: "No articles yet", Icon: FileText },
  { type: "note", title: "Notes", empty: "No notes yet", Icon: StickyNote },
] as const;

export default async function CommunityLayout({ children, params }: LayoutProps<"/c/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const { community, role } = await getCommunityForViewer(slug, user.id);
  const isModerator = canManageMembers(role);
  const [posts, quizzes, openReports, battles, rooms] = await Promise.all([
    listCommunityPosts(community.id),
    listCommunityQuizzes(community.id),
    isModerator ? countOpenReports(community.id) : 0,
    listLiveBattles(community.id),
    listLiveRooms(community.id),
  ]);
  const base = `/c/${community.slug}`;

  return (
    <>
      <AppNav>
        <Sidebar
          user={user}
          header={
            <span className="flex min-w-0 items-center gap-1.5">
              {community.visibility === "private" && <Lock className="h-4 w-4 shrink-0 text-subtle" aria-label="Private" />}
              <span className="truncate">{community.name}</span>
            </span>
          }
        >
          <div className="mb-3 px-1">
            {role ? (
              <Link href={`${base}/new`} className={`${buttonStyles.primary} w-full`}>
                <Plus className="h-4 w-4" /> Share something
              </Link>
            ) : (
              <form action={joinCommunity.bind(null, community.id)}>
                <button className={`${buttonStyles.primary} w-full`}>Join community</button>
              </form>
            )}
          </div>

          <div className="mb-4 flex flex-col gap-0.5">
            <SidebarLink href={base} icon={<Hash className={icon} />}>
              welcome
            </SidebarLink>
            <SidebarLink href={`${base}/members`} icon={<Users className={icon} />}>
              members
            </SidebarLink>
            <SidebarLink href={`${base}/leaderboard`} icon={<Trophy className={icon} />}>
              leaderboard
            </SidebarLink>
            {isModerator && (
              <SidebarLink href={`${base}/moderation`} icon={<ShieldAlert className={icon} />} badge={openReports}>
                moderation
              </SidebarLink>
            )}
          </div>

          {(battles.length > 0 || rooms.length > 0) && (
            <SidebarSection title="Live now">
              {rooms.map((r) => (
                <SidebarLink key={r.postId} href={`${base}/p/${r.postId}/room`} icon={<Headphones className="h-4 w-4 text-success" />}>
                  {r.title} · {r.people} here
                </SidebarLink>
              ))}
              {battles.map((b) => (
                <SidebarLink key={b.id} href={`${base}/b/${b.id}`} icon={<Swords className="h-4 w-4 text-danger" />}>
                  {b.quizTitle} · {b.players} {b.players === 1 ? "player" : "players"}
                </SidebarLink>
              ))}
            </SidebarSection>
          )}

          {sections.map(({ type, title, empty, Icon }) => {
            const items = posts.filter((p) => p.type === type);
            return (
              <SidebarSection
                key={type}
                title={title}
                action={
                  role && (
                    <Link
                      href={`${base}/new?type=${type}`}
                      aria-label={`Share a ${type}`}
                      title={`Share a ${type}`}
                      className="rounded text-subtle hover:text-fg"
                    >
                      <Plus className="h-4 w-4" />
                    </Link>
                  )
                }
              >
                {items.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-subtle">{empty}</p>
                ) : (
                  items.map((p) => (
                    <SidebarLink key={p.id} href={`${base}/p/${p.id}`} icon={<Icon className="h-4 w-4" />}>
                      {p.title}
                    </SidebarLink>
                  ))
                )}
              </SidebarSection>
            );
          })}

          <SidebarSection
            title="Quizzes"
            action={
              role && (
                <Link href={`${base}/quizzes/new`} aria-label="Create a quiz" title="Create a quiz" className="rounded text-subtle hover:text-fg">
                  <Plus className="h-4 w-4" />
                </Link>
              )
            }
          >
            {quizzes.length === 0 ? (
              <p className="px-2 py-1 text-sm text-subtle">No quizzes yet</p>
            ) : (
              quizzes.map((q) => (
                <SidebarLink key={q.id} href={`${base}/q/${q.id}`} icon={<ListChecks className="h-4 w-4" />}>
                  {q.title}
                </SidebarLink>
              ))
            )}
          </SidebarSection>

          {role && role !== "owner" && (
            <form action={leaveCommunity.bind(null, community.id)} className="px-1">
              <button className="flex items-center gap-1.5 rounded px-1 py-1 text-sm text-subtle hover:text-danger">
                <DoorOpen className="h-4 w-4" /> Leave community
              </button>
            </form>
          )}
        </Sidebar>
      </AppNav>
      <MainPane>{children}</MainPane>
    </>
  );
}
