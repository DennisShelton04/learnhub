import { Compass, Hash, House, Plus } from "lucide-react";
import { AppNav, MainPane } from "@/components/shell/AppNav";
import { Sidebar, SidebarSection } from "@/components/shell/Sidebar";
import { SidebarLink } from "@/components/shell/SidebarLink";
import { requireUser } from "@/lib/session";
import { listUserCommunities } from "@/server/communities";

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const communities = await listUserCommunities(user.id);
  const icon = "h-5 w-5";

  return (
    <>
      <AppNav>
        <Sidebar header="LearnHub" user={user}>
          <div className="mb-4 flex flex-col gap-0.5">
            <SidebarLink href="/dashboard" icon={<House className={icon} />}>
              Home
            </SidebarLink>
            <SidebarLink href="/communities" icon={<Compass className={icon} />}>
              Browse communities
            </SidebarLink>
            <SidebarLink href="/communities/new" icon={<Plus className={icon} />}>
              Create a community
            </SidebarLink>
          </div>
          <SidebarSection title="Your communities">
            {communities.length === 0 ? (
              <p className="px-2 text-sm text-subtle">None yet</p>
            ) : (
              communities.map((c) => (
                <SidebarLink key={c.id} href={`/c/${c.slug}`} icon={<Hash className={icon} />}>
                  {c.name}
                </SidebarLink>
              ))
            )}
          </SidebarSection>
        </Sidebar>
      </AppNav>
      <MainPane>{children}</MainPane>
    </>
  );
}
