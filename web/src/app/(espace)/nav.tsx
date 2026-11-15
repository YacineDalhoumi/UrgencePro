"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, LayoutDashboard, Settings, Users } from "lucide-react";
import { cn } from "@/components/ui";
import type { Role } from "@/lib/auth";

const LIENS = [
  { href: "/tableau-de-bord", label: "Tableau de bord", court: "Accueil", icone: LayoutDashboard, roles: ["gerant"] },
  { href: "/demandes", label: "Demandes", court: "Demandes", icone: ClipboardList, roles: ["gerant"] },
  { href: "/agenda", label: "Agenda", court: "Agenda", icone: CalendarDays, roles: ["gerant", "technicien"] },
  { href: "/techniciens", label: "Techniciens", court: "Équipe", icone: Users, roles: ["gerant"] },
  { href: "/parametres", label: "Paramètres", court: "Réglages", icone: Settings, roles: ["gerant", "technicien"] },
] as const;

/** Menu principal (5 entrées au plus) : en haut sur ordinateur, en bas sur téléphone. */
export function NavLiens({ role, variante }: { role: Role; variante: "haut" | "bas" }) {
  const pathname = usePathname();
  const liens = LIENS.filter((l) => (l.roles as readonly string[]).includes(role));
  if (variante === "haut") {
    return (
      <nav className="ml-4 hidden gap-1 md:flex" aria-label="Menu principal">
        {liens.map((l) => {
          const actif = pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={actif ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold", actif ? "bg-white/15 text-white" : "text-ink-fg/70 hover:text-ink-fg")}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Menu principal">
      <ul className="flex">
        {liens.map((l) => {
          const actif = pathname.startsWith(l.href);
          const Icone = l.icone;
          return (
            <li key={l.href} className="flex-1">
              <Link href={l.href} aria-current={actif ? "page" : undefined} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", actif ? "text-accent" : "text-muted")}>
                <Icone className="size-5" />
                {l.court}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
