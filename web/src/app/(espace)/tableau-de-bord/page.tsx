import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarClock, FileClock, Minus, Plus, TriangleAlert } from "lucide-react";
import { requireGerant } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/server";
import { dateHeure, eur, FUSEAU, heureFr } from "@/lib/format";
import { Alert, Card, CardTitle, cn } from "@/components/ui";
import { GraphiqueCa, GraphiqueTechniciens } from "./graphiques";

export const metadata: Metadata = { title: "Tableau de bord" };

const PERIODES = {
  ce_mois: "Ce mois",
  mois_dernier: "Mois dernier",
  "3_mois": "3 mois",
  annee: "Année",
} as const;
type Periode = keyof typeof PERIODES;

interface Indicateurs {
  ca_ttc: number;
  demandes_recues: number;
  devis_envoyes: number;
  devis_signes: number;
  taux_signature: number | null;
  panier_moyen: number | null;
  delai_moyen_heures: number | null;
  interventions_terminees: number;
}
interface Tableau {
  periode: { debut: string; fin: string; pas: "week" | "month" };
  actuel: Indicateurs;
  precedent: Indicateurs;
  ca_par_periode: { debut: string; ca_ttc: number }[];
  interventions_par_technicien: { technicien_id: string; nom: string; couleur: string | null; terminees: number; planifiees: number }[];
  a_traiter: {
    devis_sans_reponse: { demande_id: string; numero: string; client: string | null; total_ttc: number | null; envoye_at: string }[];
    a_planifier: { demande_id: string; reference: string; client: string | null; note: string | null; depuis: string }[];
    interventions_du_jour: { intervention_id: string; demande_id: string; debut: string; fin: string; technicien: string; couleur: string | null; client: string | null; adresse: string | null; statut: string }[];
  };
}

/** Bornes [début, fin[ de la période, en dates de Paris. */
function bornes(p: Periode): [string, string] {
  const [a, m] = new Date().toLocaleDateString("sv-SE", { timeZone: FUSEAU }).split("-").map(Number);
  const d = (annee: number, mois: number) => new Date(Date.UTC(annee, mois - 1, 1)).toISOString().slice(0, 10);
  switch (p) {
    case "mois_dernier":
      return [d(a, m - 1), d(a, m)];
    case "3_mois":
      return [d(a, m - 2), d(a, m + 1)];
    case "annee":
      return [d(a, 1), d(a + 1, 1)];
    default:
      return [d(a, m), d(a, m + 1)];
  }
}

const delai = (h: number | null) => (h == null ? "—" : h < 48 ? `${String(Math.round(h * 10) / 10).replace(".", ",")} h` : `${String(Math.round((h / 24) * 10) / 10).replace(".", ",")} j`);
const pctTxt = (n: number | null) => (n == null ? "—" : `${String(n).replace(".", ",")} %`);

function Variation({ actuel, precedent, inverse = false }: { actuel: number | null; precedent: number | null; inverse?: boolean }) {
  if (actuel == null || precedent == null) return <span className="text-xs text-muted">pas de comparaison</span>;
  if (precedent === 0) return <span className="text-xs text-muted">{actuel === 0 ? "stable" : "nouveau sur la période"}</span>;
  const v = Math.round(((actuel - precedent) / Math.abs(precedent)) * 100);
  if (v === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted">
        <Minus className="size-3" /> stable
      </span>
    );
  const bon = inverse ? v < 0 : v > 0;
  const Icone = v > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", bon ? "text-ok" : "text-bad")}>
      <Icone className="size-3.5" /> {v > 0 ? "+" : ""}
      {v} % vs période précédente
    </span>
  );
}

function Tuile({ label, valeur, children }: { label: string; valeur: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="label-caps text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tnum">{valeur}</p>
      <div className="mt-1">{children}</div>
    </Card>
  );
}

export default async function PageTableauDeBord({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requireGerant("/tableau-de-bord");
  const { periode: brut } = await searchParams;
  const periode: Periode = brut && brut in PERIODES ? (brut as Periode) : "ce_mois";
  const [debut, fin] = bornes(periode);
  const db = await createAuthClient();
  const { data, error } = await db.rpc("tableau_de_bord", { p_debut: debut, p_fin: fin });
  const t = data as Tableau | null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted">Comparé à la période précédente de même durée.</p>
        </div>
        <Link href="/demandes/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90">
          <Plus className="size-4" /> Nouvelle demande
        </Link>
      </div>

      <nav className="mb-5 flex gap-1.5 overflow-x-auto pb-1" aria-label="Période">
        {(Object.keys(PERIODES) as Periode[]).map((p) => (
          <Link
            key={p}
            href={p === "ce_mois" ? "/tableau-de-bord" : `/tableau-de-bord?periode=${p}`}
            aria-current={p === periode ? "page" : undefined}
            className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold", p === periode ? "border-ink bg-ink text-ink-fg" : "border-border bg-surface text-muted hover:text-fg")}
          >
            {PERIODES[p]}
          </Link>
        ))}
      </nav>

      {(error || !t) && (
        <Alert tone="bad" title="Tableau de bord indisponible">
          {error?.message ?? "Aucune donnée."}
        </Alert>
      )}

      {t && (
        <>
          <section className="mb-6" aria-labelledby="titre-a-traiter">
            <h2 id="titre-a-traiter" className="mb-2 font-display text-lg font-bold">
              À traiter
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Card>
                <CardTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4 text-muted" /> Interventions du jour
                  </span>
                </CardTitle>
                <ListeVide vide={!t.a_traiter.interventions_du_jour.length} texte="Aucune intervention aujourd’hui.">
                  {t.a_traiter.interventions_du_jour.map((i) => (
                    <Ligne key={i.intervention_id} href={`/demandes/${i.demande_id}`} titre={`${heureFr(i.debut)} · ${i.client ?? "Client"}`} detail={`${i.technicien}${i.statut === "terminee" ? " · terminée" : ""}${i.adresse ? ` · ${i.adresse}` : ""}`} pastille={i.couleur} />
                  ))}
                </ListeVide>
              </Card>
              <Card>
                <CardTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <TriangleAlert className="size-4 text-warn" /> À planifier
                  </span>
                </CardTitle>
                <ListeVide vide={!t.a_traiter.a_planifier.length} texte="Toutes les demandes signées sont planifiées.">
                  {t.a_traiter.a_planifier.map((d) => (
                    <Ligne key={d.demande_id} href={`/demandes/${d.demande_id}`} titre={d.client ?? d.reference} detail={d.note ?? `Devis signé le ${dateHeure(d.depuis)}`} />
                  ))}
                </ListeVide>
              </Card>
              <Card>
                <CardTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <FileClock className="size-4 text-muted" /> Devis sans réponse depuis 3 jours
                  </span>
                </CardTitle>
                <ListeVide vide={!t.a_traiter.devis_sans_reponse.length} texte="Aucun devis en attente depuis plus de 3 jours.">
                  {t.a_traiter.devis_sans_reponse.map((d) => (
                    <Ligne key={d.numero} href={`/demandes/${d.demande_id}`} titre={`${d.client ?? "Client"} · ${eur(d.total_ttc)}`} detail={`${d.numero}, envoyé le ${dateHeure(d.envoye_at)}`} />
                  ))}
                </ListeVide>
              </Card>
            </div>
          </section>

          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Indicateurs">
            <Tuile label="CA facturé TTC" valeur={eur(t.actuel.ca_ttc)}>
              <Variation actuel={t.actuel.ca_ttc} precedent={t.precedent.ca_ttc} />
            </Tuile>
            <Tuile label="Demandes reçues" valeur={String(t.actuel.demandes_recues)}>
              <Variation actuel={t.actuel.demandes_recues} precedent={t.precedent.demandes_recues} />
            </Tuile>
            <Tuile label="Taux de signature" valeur={pctTxt(t.actuel.taux_signature)}>
              <p className="text-xs text-muted">
                {t.actuel.devis_signes} signé{t.actuel.devis_signes > 1 ? "s" : ""} sur {t.actuel.devis_envoyes} envoyé{t.actuel.devis_envoyes > 1 ? "s" : ""}
              </p>
              <Variation actuel={t.actuel.taux_signature} precedent={t.precedent.taux_signature} />
            </Tuile>
            <Tuile label="Panier moyen" valeur={t.actuel.panier_moyen == null ? "—" : eur(t.actuel.panier_moyen)}>
              <Variation actuel={t.actuel.panier_moyen} precedent={t.precedent.panier_moyen} />
            </Tuile>
            <Tuile label="Délai demande → intervention" valeur={delai(t.actuel.delai_moyen_heures)}>
              <Variation actuel={t.actuel.delai_moyen_heures} precedent={t.precedent.delai_moyen_heures} inverse />
            </Tuile>
            <Tuile label="Interventions terminées" valeur={String(t.actuel.interventions_terminees)}>
              <Variation actuel={t.actuel.interventions_terminees} precedent={t.precedent.interventions_terminees} />
            </Tuile>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="font-display font-bold">CA facturé TTC par {t.periode.pas === "month" ? "mois" : "semaine"}</h2>
              <GraphiqueCa points={t.ca_par_periode} pas={t.periode.pas} />
            </Card>
            <Card className="p-4">
              <h2 className="font-display font-bold">Interventions par technicien</h2>
              <GraphiqueTechniciens lignes={t.interventions_par_technicien} />
            </Card>
          </section>
        </>
      )}
    </>
  );
}

function ListeVide({ vide, texte, children }: { vide: boolean; texte: string; children: React.ReactNode }) {
  if (vide) return <p className="px-4 pb-4 text-sm text-muted">{texte}</p>;
  return <ul className="divide-y divide-border border-t border-border">{children}</ul>;
}

function Ligne({ href, titre, detail, pastille }: { href: string; titre: string; detail: string; pastille?: string | null }) {
  return (
    <li>
      <Link href={href} className="flex items-start gap-2 px-4 py-2.5 hover:bg-sunken/60">
        {pastille && <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: pastille }} />}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{titre}</span>
          <span className="block truncate text-xs text-muted">{detail}</span>
        </span>
      </Link>
    </li>
  );
}
