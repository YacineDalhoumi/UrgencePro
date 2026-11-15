import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireArtisan } from "@/lib/auth";
import { seDeconnecter } from "@/app/connexion/actions";
import { NavLiens } from "./nav";

export default async function EspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireArtisan();
  return (
    <div className="min-h-dvh pb-16 md:pb-0">
      <header className="sticky top-0 z-30 bg-ink text-ink-fg" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href={user.role === "gerant" ? "/tableau-de-bord" : "/agenda"} className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-accent font-display font-extrabold text-accent-fg">U</span>
            <span className="font-display font-bold">UrgencePro</span>
          </Link>
          <NavLiens role={user.role} variante="haut" />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-ink-fg/70 lg:inline">{user.email}</span>
            <form action={seDeconnecter}>
              <button type="submit" className="inline-flex size-9 items-center justify-center rounded-md text-ink-fg/80 hover:bg-white/10" aria-label="Se déconnecter" title="Se déconnecter">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      <NavLiens role={user.role} variante="bas" />
    </div>
  );
}
