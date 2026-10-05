import { UserPanel } from "@/components/shell/UserPanel";

/** The second column: a header, scrollable content, and the signed-in user at the bottom. */
export function Sidebar({
  header,
  children,
  user,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  user: { id: string; name: string };
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar">
      <div className="flex h-12 shrink-0 items-center border-b border-line px-4 font-semibold shadow-sm">{header}</div>
      <div className="scroll-thin flex-1 overflow-y-auto px-2 py-3">{children}</div>
      <UserPanel user={user} />
    </aside>
  );
}

export function SidebarSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <div className="flex items-center justify-between px-2 pb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}
