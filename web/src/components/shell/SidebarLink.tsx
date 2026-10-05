"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A channel-style link that highlights when its page is open. */
export function SidebarLink({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
}) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-1.5 rounded px-2 py-1.5 text-[15px] ${
        active ? "bg-selected font-medium text-fg" : "text-subtle hover:bg-hover hover:text-fg"
      }`}
    >
      <span className="shrink-0 text-subtle">{icon}</span>
      <span className="truncate">{children}</span>
      {badge ? (
        <span className="ml-auto rounded-full bg-danger px-1.5 text-xs font-bold text-white" aria-label={`${badge} open`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
