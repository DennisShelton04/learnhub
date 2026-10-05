"use client";

import { Compass, GraduationCap, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { initials } from "@/components/Avatar";

type RailCommunity = { id: string; slug: string; name: string };

function RailItem({
  href,
  label,
  active,
  children,
  variant = "community",
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
  variant?: "community" | "action";
}) {
  return (
    <li className="group relative flex justify-center">
      {/* Active / hover pill on the left edge, like Discord. */}
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-fg transition-all ${
          active ? "h-10" : "h-0 group-hover:h-5"
        }`}
      />
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        title={label}
        className={`flex h-12 w-12 items-center justify-center overflow-hidden text-sm font-semibold transition-all ${
          active ? "rounded-2xl" : "rounded-3xl hover:rounded-2xl"
        } ${
          variant === "action"
            ? "bg-main text-success hover:bg-success hover:text-white"
            : active
              ? "bg-accent text-white"
              : "bg-main text-fg hover:bg-accent hover:text-white"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}

export function ServerRail({ communities }: { communities: RailCommunity[] }) {
  const pathname = usePathname();
  const inCommunity = (slug: string) => pathname === `/c/${slug}` || pathname.startsWith(`/c/${slug}/`);
  const onHome = !pathname.startsWith("/c/") && !pathname.startsWith("/communities");

  return (
    <nav aria-label="Communities" className="scroll-thin w-[72px] shrink-0 overflow-y-auto bg-rail py-3">
      <ul className="flex flex-col gap-2">
        <RailItem href="/dashboard" label="Home" active={onHome}>
          <GraduationCap className="h-6 w-6" />
        </RailItem>
        <li aria-hidden className="mx-auto h-0.5 w-8 rounded bg-line" />
        {communities.map((c) => (
          <RailItem key={c.id} href={`/c/${c.slug}`} label={c.name} active={inCommunity(c.slug)}>
            {initials(c.name)}
          </RailItem>
        ))}
        <RailItem href="/communities/new" label="Create a community" active={pathname === "/communities/new"} variant="action">
          <Plus className="h-6 w-6" />
        </RailItem>
        <RailItem href="/communities" label="Browse communities" active={pathname === "/communities"} variant="action">
          <Compass className="h-6 w-6" />
        </RailItem>
      </ul>
    </nav>
  );
}
