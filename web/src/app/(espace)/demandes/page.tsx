import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search, TriangleAlert } from "lucide-react";
import { requireGerant } from "@/lib/auth";
import { listerDemandes, PAGE_TAILLE } from "@/lib/donnees";
import { dateHeure, etapeInfo } from "@/lib/format";
import { Alert, Badge, Card, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Demandes" };

type Params = { filtre?: string; q?: string; page?: string };

const FILTRES: [string | undefined, string][] = [
  [undefined, "Toutes"],
  ["en_cours", "En cours"],
  ["a_planifier", "À planifier"],
  ["terminees", "Terminées"],
  ["closes", "Refusées ou annulées"],
];

function lien(p: Params, patch: Partial<Params>) {
  const q = new URLSearchParams();
  const m = { ...p, ...patch };
  if (m.filtre) q.set("filtre", m.filtre);
  if (m.q) q.set("q", m.q);
  if (m.page && m.page !== "1") q.set("page", m.page);
  const s = q.toString();
  return `/demandes${s ? `?${s}` : ""}`;
}

function Pastille({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold", actif ? "border-ink bg-ink text-ink-fg" : "border-border bg-surface text-muted hover:text-fg")}>
      {children}
    </Link>
  );
}

export default async function PageDemandes({ searchParams }: { searchParams: Promise<Params> }) {
  await requireGerant("/demandes");
  const p = await searchParams;
  const page = Math.max(1, Number(p.page) || 1);

  let resultat: Awaited<ReturnType<typeof listerDemandes>> | null = null;
  let erreur: string | null = null;
  try {
    resultat = await listerDemandes({ filtre: p.filtre, recherche: p.q, page });
  } catch (e) {
    erreur = (e as Error).message;
  }
  const pages = resultat ? Math.max(1, Math.ceil(resultat.total / PAGE_TAILLE)) : 1;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Demandes</h1>
          <p className="mt-1 text-sm text-muted">Chaque demande suit son parcours : devis, signature, intervention, facture.</p>
        </div>
        <Link href="/demandes/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90">
          <Plus className="size-4" /> Nouvelle demande
        </Link>
      </div>

      <div className="mb-4 space-y-2">
        <form action="/demandes" className="relative max-w-md">
          {p.filtre && <input type="hidden" name="filtre" value={p.filtre} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={p.q ?? ""}
            placeholder="Rechercher un client ou une référence"
            className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-[15px] placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />
        </form>
        <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Filtrer">
          {FILTRES.map(([v, l]) => (
            <Pastille key={l} href={lien(p, { filtre: v, page: undefined })} actif={p.filtre === v}>
              {l}
            </Pastille>
          ))}
        </div>
      </div>

      {erreur && (
        <Alert tone="bad" title="Demandes indisponibles">
          {erreur}
        </Alert>
      )}

      {resultat && resultat.lignes.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted">
          Aucune demande{p.filtre || p.q ? " pour ces critères" : ""}.{" "}
          <Link href="/demandes/nouvelle" className="font-semibold text-accent hover:underline">
            Créer une demande
          </Link>
        </Card>
      )}

      {resultat && resultat.lignes.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {resultat.lignes.map((d) => {
              const e = etapeInfo(d.etape);
              return (
                <li key={d.id}>
                  <Link href={`/demandes/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{d.client_nom || "Client sans nom"}</span>
                        <Badge tone={e.tone}>{e.label}</Badge>
                        {d.a_planifier_manuellement && (
                          <Badge tone="warn">
                            <TriangleAlert className="size-3" /> À planifier manuellement
                          </Badge>
                        )}
                        {d.statut === "erreur" && <Badge tone="bad">Envoi à refaire</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">{d.message}</p>
                      <p className="text-xs text-muted tnum">
                        {d.reference} · {dateHeure(d.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
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
