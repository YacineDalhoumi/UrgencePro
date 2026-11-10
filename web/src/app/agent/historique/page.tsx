import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireArtisan } from "@/lib/auth";
import { listerDemandes, PAGE_TAILLE } from "@/lib/agent/db";
import { TYPE_LABEL, TYPES_DEMANDE, type TypeDemande } from "@/lib/agent/types";
import { Alert, Badge, Card, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Historique" };

type Params = { type?: string; statut?: string; page?: string };

const dateHeure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function lien(p: Params, patch: Partial<Params>) {
  const q = new URLSearchParams();
  const m = { ...p, ...patch };
  if (m.type) q.set("type", m.type);
  if (m.statut) q.set("statut", m.statut);
  if (m.page && m.page !== "1") q.set("page", m.page);
  const s = q.toString();
  return `/agent/historique${s ? `?${s}` : ""}`;
}

function Pastille({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold", actif ? "border-ink bg-ink text-ink-fg" : "border-border bg-surface text-muted hover:text-fg")}>
      {children}
    </Link>
  );
}

export default async function PageHistorique({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireArtisan("/agent/historique");
  const p = await searchParams;
  const page = Math.max(1, Number(p.page) || 1);

  let resultat: Awaited<ReturnType<typeof listerDemandes>> | null = null;
  let erreur: string | null = null;
  try {
    resultat = await listerDemandes({ artisanId: user.artisanId, type: p.type, statut: p.statut, page });
  } catch (e) {
    erreur = (e as Error).message;
  }
  const pages = resultat ? Math.max(1, Math.ceil(resultat.total / PAGE_TAILLE)) : 1;

  return (
    <>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Historique</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Demandes traitées par l’agent pour l’artisan <span className="font-mono">{user.artisanId}</span>, de la plus récente à la plus ancienne.
      </p>

      <div className="mb-4 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Filtrer par type">
          <Pastille href={lien(p, { type: undefined, page: undefined })} actif={!p.type}>
            Tous les types
          </Pastille>
          {TYPES_DEMANDE.map((t) => (
            <Pastille key={t} href={lien(p, { type: t, page: undefined })} actif={p.type === t}>
              {TYPE_LABEL[t]}
            </Pastille>
          ))}
        </div>
        <div className="flex gap-1.5" aria-label="Filtrer par statut">
          {[
            [undefined, "Tous les statuts"],
            ["traite", "Traitées"],
            ["erreur", "En erreur"],
          ].map(([v, l]) => (
            <Pastille key={l} href={lien(p, { statut: v, page: undefined })} actif={p.statut === v}>
              {l}
            </Pastille>
          ))}
        </div>
      </div>

      {erreur && (
        <Alert tone="bad" title="Historique indisponible">
          {erreur}
        </Alert>
      )}

      {resultat && resultat.lignes.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted">
          Aucune demande{p.type || p.statut ? " pour ces filtres" : ""}.{" "}
          <Link href="/agent/nouvelle" className="font-semibold text-accent hover:underline">
            Envoyer une demande
          </Link>
        </Card>
      )}

      {resultat && resultat.lignes.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {resultat.lignes.map((d) => (
              <li key={d.id}>
                <Link href={`/agent/historique/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{TYPE_LABEL[d.type_demande as TypeDemande] ?? d.type_demande ?? "—"}</Badge>
                      {d.statut === "erreur" ? <Badge tone="bad">Erreur</Badge> : <Badge tone="ok">Traitée</Badge>}
                      {d.donnees_fictives && <Badge tone="warn">Démo</Badge>}
                      <span className="text-xs text-muted tnum">{dateHeure(d.created_at)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm">{d.message}</p>
                    <p className="text-xs text-muted">
                      <span className="font-mono">{d.reference}</span>
                      {d.client_nom && ` · ${d.client_nom}`}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
            <span className="tnum">
              {resultat.total} demande{resultat.total > 1 ? "s" : ""} · page {page}/{pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={lien(p, { page: String(page - 1) })} className="rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-sunken">
                  Précédente
                </Link>
              )}
              {page < pages && (
                <Link href={lien(p, { page: String(page + 1) })} className="rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-sunken">
                  Suivante
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
