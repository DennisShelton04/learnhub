"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";

type ShellState = { open: boolean; setOpen: (open: boolean) => void };
const ShellContext = createContext<ShellState>({ open: false, setOpen: () => {} });

/** Holds the mobile navigation drawer state. The drawer closes itself on navigation. */
export function ShellProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Remember which page the drawer was opened on; moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const value = { open: openOn === pathname, setOpen: (open: boolean) => setOpenOn(open ? pathname : null) };
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/** Wraps the server rail + sidebar: static on desktop, a slide-in drawer on phones. */
export function NavDrawer({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useContext(ShellContext);
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {children}
      </div>
    </>
  );
}

export function MenuButton() {
  const { setOpen } = useContext(ShellContext);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open navigation"
      className="-ml-1 rounded p-1 text-muted hover:bg-hover hover:text-fg md:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
