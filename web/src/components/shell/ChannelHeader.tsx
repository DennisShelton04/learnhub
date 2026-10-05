import { MenuButton } from "@/components/shell/Shell";

/** The top bar of the main pane (like a Discord channel header). */
export function ChannelHeader({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4 shadow-sm">
      <MenuButton />
      {icon && <span className="shrink-0 text-subtle">{icon}</span>}
      <h1 className="min-w-0 truncate font-semibold">{title}</h1>
      {children && <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>}
    </header>
  );
}
