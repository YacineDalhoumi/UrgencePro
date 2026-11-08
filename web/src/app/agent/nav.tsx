"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LIENS = [
  { href: "/agent/nouvelle", label: "Nouvelle demande", court: "Nouvelle" },
  { href: "/agent/historique", label: "Historique", court: "Historique" },
  { href: "/agent/diagnostic", label: "Diagnostic", court: "Diag." },
];

export function NavLiens() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Agent IA">
      {LIENS.map((l) => {
        const actif = pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={actif ? "page" : undefined} className={`rounded-md px-2.5 py-1.5 text-sm font-semibold sm:px-3 ${actif ? "bg-white/15 text-white" : "text-ink-fg/70 hover:text-ink-fg"}`}>
            <span className="sm:hidden">{l.court}</span>
            <span className="hidden sm:inline">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
