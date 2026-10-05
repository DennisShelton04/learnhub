import { NavDrawer } from "@/components/shell/Shell";
import { ServerRail } from "@/components/shell/ServerRail";
import { requireUser } from "@/lib/session";
import { listUserCommunities } from "@/server/communities";

/** Community rail + the given sidebar; becomes a drawer on small screens. */
export async function AppNav({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const communities = await listUserCommunities(user.id);
  return (
    <NavDrawer>
      <ServerRail communities={communities} />
      {children}
    </NavDrawer>
  );
}

export function MainPane({ children }: { children: React.ReactNode }) {
  return <main className="flex min-w-0 flex-1 flex-col bg-main">{children}</main>;
}

/** Scrollable content area under a ChannelHeader. */
export function PageBody({ children, width = "max-w-4xl" }: { children: React.ReactNode; width?: string }) {
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className={`mx-auto flex w-full ${width} flex-col gap-6 px-4 py-6 sm:px-6`}>{children}</div>
    </div>
  );
}
