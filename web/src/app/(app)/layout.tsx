import { ShellProvider } from "@/components/shell/Shell";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <ShellProvider>
      <div className="flex h-dvh overflow-hidden">{children}</div>
    </ShellProvider>
  );
}
