import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { seDeconnecter } from "@/app/connexion/actions";
import { NavLiens } from "./nav";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-ink text-ink-fg" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/agent/nouvelle" className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-accent font-display font-extrabold text-accent-fg">U</span>
            <span className="hidden font-display font-bold sm:inline">UrgencePro</span>
          </Link>
          <NavLiens />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-ink-fg/70 md:inline">{user.email}</span>
            <form action={seDeconnecter}>
              <button type="submit" className="inline-flex size-9 items-center justify-center rounded-md text-ink-fg/80 hover:bg-white/10" aria-label="Se déconnecter" title="Se déconnecter">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
