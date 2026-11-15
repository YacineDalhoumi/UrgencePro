"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, Phone, Radio, X } from "lucide-react";
import { Alert, Button, Card, Field, Input, Select, cn } from "@/components/ui";
import { TerminerForm } from "@/components/cycle/TerminerForm";
import { deplacerIntervention, type Etat } from "../actions";
import { createNavigateurClient } from "@/lib/supabase/client";
import { couleurTech, heureFr, isoVersParis, jourLong } from "@/lib/format";
import type { InterventionAgenda } from "@/lib/donnees";
import type { Role } from "@/lib/auth";

type Tech = { id: string; nom: string; couleur: string | null; disponible: boolean };

const HEURE_DEBUT = 7;
const HEURE_FIN = 21;
const PX_HEURE = 52;

const minutesParis = (iso: string) => {
  const [h, m] = isoVersParis(iso).heure.split(":").map(Number);
  return h * 60 + m;
};
const nomJour = (date: string, format: "long" | "court") =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", format === "long" ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" } : { weekday: "short", day: "numeric", timeZone: "UTC" });

/** Répartit les interventions d'une journée en colonnes pour qu'elles ne se recouvrent pas à l'écran. */
function colonnes(liste: InterventionAgenda[]) {
  const triees = [...liste].sort((a, b) => a.debut.localeCompare(b.debut));
  const fins: string[] = [];
  const place = new Map<string, number>();
  for (const iv of triees) {
    let c = fins.findIndex((f) => f <= iv.debut);
    if (c === -1) c = fins.push(iv.fin) - 1;
    else fins[c] = iv.fin;
    place.set(iv.id, c);
  }
  return { place, total: Math.max(1, fins.length) };
}

export function AgendaVue(p: {
  role: Role;
  technicienCourant: string | null;
  jours: string[];
  aujourdhui: string;
  precedente: string;
  suivante: string;
  interventions: InterventionAgenda[];
  techniciens: Tech[];
}) {
  const router = useRouter();
  const [filtre, setFiltre] = useState<string>("tous");
  const [jourMobile, setJourMobile] = useState(() => (p.jours.includes(p.aujourdhui) ? p.aujourdhui : p.jours[0]));
  const [selection, setSelection] = useState<string | null>(null);
  const [direct, setDirect] = useState(false);
  const gerant = p.role === "gerant";

  const couleurs = useMemo(() => Object.fromEntries(p.techniciens.map((t, i) => [t.id, couleurTech(t.couleur, i)])), [p.techniciens]);
  const noms = useMemo(() => Object.fromEntries(p.techniciens.map((t) => [t.id, t.nom])), [p.techniciens]);
  const visibles = p.interventions.filter((i) => filtre === "tous" || i.technicien_id === filtre);
  const parJour = useMemo(() => {
    const m: Record<string, InterventionAgenda[]> = {};
    for (const iv of visibles) (m[isoVersParis(iv.debut).date] ??= []).push(iv);
    return m;
  }, [visibles]);
  const choisie = p.interventions.find((i) => i.id === selection) ?? null;

  // Temps réel : toute modification d'intervention visible par ce compte recharge l'agenda
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const db = createNavigateurClient();
    const canal = db
      .channel("agenda-interventions")
      .on("postgres_changes", { event: "*", schema: "public", table: "interventions" }, () => {
        if (attente.current) clearTimeout(attente.current);
        attente.current = setTimeout(() => router.refresh(), 400);
      })
      .subscribe((statut) => setDirect(statut === "SUBSCRIBED"));
    return () => {
      if (attente.current) clearTimeout(attente.current);
      db.removeChannel(canal);
    };
  }, [router]);

  const heures = Array.from({ length: HEURE_FIN - HEURE_DEBUT }, (_, i) => HEURE_DEBUT + i);

  const colonne = (date: string) => {
    const liste = parJour[date] ?? [];
    const { place, total } = colonnes(liste);
    return (
      <div className={cn("relative border-l border-border", date === p.aujourdhui && "bg-accent-soft/30")} style={{ height: heures.length * PX_HEURE }}>
        {heures.map((h) => (
          <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: (h - HEURE_DEBUT) * PX_HEURE }} />
        ))}
        {liste.map((iv) => {
          const debut = Math.max(minutesParis(iv.debut), HEURE_DEBUT * 60);
          const fin = Math.min(Math.max(minutesParis(iv.fin), debut + 20), HEURE_FIN * 60);
          const c = place.get(iv.id) ?? 0;
          const couleur = couleurs[iv.technicien_id] ?? "#64748b";
          return (
            <button
              key={iv.id}
              type="button"
              onClick={() => setSelection(iv.id)}
              className={cn("absolute overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-xs shadow-sm hover:z-10 hover:shadow-md focus-visible:z-10", iv.statut === "terminee" && "opacity-60")}
              style={{
                top: ((debut - HEURE_DEBUT * 60) / 60) * PX_HEURE + 1,
                height: ((fin - debut) / 60) * PX_HEURE - 2,
                left: `calc(${(c / total) * 100}% + 2px)`,
                width: `calc(${100 / total}% - 4px)`,
                borderLeftColor: couleur,
                background: `color-mix(in srgb, ${couleur} 16%, var(--surface))`,
              }}
            >
              <span className="block font-semibold tnum">
                {heureFr(iv.debut)} {iv.statut === "terminee" && "· terminée"}
              </span>
              <span className="block truncate">{iv.demande?.client_nom ?? "Client"}</span>
              <span className="block truncate text-muted">{noms[iv.technicien_id]}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{gerant ? "Agenda" : "Mon agenda"}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            Semaine du {nomJour(p.jours[0], "long")}
            {direct && (
              <span className="inline-flex items-center gap-1 text-ok" title="Mise à jour automatique">
                <Radio className="size-3.5" /> en direct
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/agenda?semaine=${p.precedente}`} className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface hover:bg-sunken" aria-label="Semaine précédente">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href="/agenda" className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-sunken">
            Aujourd’hui
          </Link>
          <Link href={`/agenda?semaine=${p.suivante}`} className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface hover:bg-sunken" aria-label="Semaine suivante">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      {gerant && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Filtrer par technicien">
          <button type="button" onClick={() => setFiltre("tous")} className={cn("whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold", filtre === "tous" ? "border-ink bg-ink text-ink-fg" : "border-border bg-surface text-muted")}>
            Tous les techniciens
          </button>
          {p.techniciens.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFiltre(t.id)}
              className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold", filtre === t.id ? "border-ink bg-ink text-ink-fg" : "border-border bg-surface text-muted")}
            >
              <span className="size-2.5 rounded-full" style={{ background: couleurs[t.id] }} /> {t.nom}
            </button>
          ))}
        </div>
      )}

      {/* Téléphone : un jour à la fois */}
      <div className="mb-3 flex gap-1 overflow-x-auto md:hidden" aria-label="Choisir le jour">
        {p.jours.map((j) => (
          <button
            key={j}
            type="button"
            onClick={() => setJourMobile(j)}
            className={cn("min-w-12 flex-1 rounded-md border px-1 py-1.5 text-xs font-semibold capitalize", jourMobile === j ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted", j === p.aujourdhui && jourMobile !== j && "text-accent")}
          >
            {nomJour(j, "court")}
            {(parJour[j]?.length ?? 0) > 0 && <span className="block text-[10px] opacity-80">{parJour[j].length} rdv</span>}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-border bg-sunken text-xs font-semibold md:grid">
          <div />
          {p.jours.map((j) => (
            <div key={j} className={cn("px-2 py-2 capitalize", j === p.aujourdhui && "text-accent")}>
              {nomJour(j, "court")}
            </div>
          ))}
        </div>
        <div className="max-h-[70dvh] overflow-y-auto">
          <div className="grid grid-cols-[3rem_minmax(0,1fr)] md:grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
            <div className="relative" style={{ height: heures.length * PX_HEURE }}>
              {heures.map((h) => (
                <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-muted tnum" style={{ top: (h - HEURE_DEBUT) * PX_HEURE }}>
                  {h > HEURE_DEBUT ? `${h} h` : ""}
                </span>
              ))}
            </div>
            <div className="md:hidden">
              {colonne(jourMobile)}
            </div>
            {p.jours.map((j) => (
              <div key={j} className="hidden md:block">
                {colonne(j)}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {visibles.length === 0 && <p className="mt-3 text-center text-sm text-muted">Aucune intervention cette semaine.</p>}

      {choisie && (
        <Detail
          iv={choisie}
          gerant={gerant}
          peutTerminer={gerant || choisie.technicien_id === p.technicienCourant}
          techniciens={p.techniciens}
          couleur={couleurs[choisie.technicien_id]}
          nomTech={noms[choisie.technicien_id]}
          fermer={() => setSelection(null)}
        />
      )}
    </>
  );
}

function Detail({ iv, gerant, peutTerminer, techniciens, couleur, nomTech, fermer }: { iv: InterventionAgenda; gerant: boolean; peutTerminer: boolean; techniciens: Tech[]; couleur?: string; nomTech?: string; fermer: () => void }) {
  const [modifier, setModifier] = useState(false);
  const [etat, action, enCours] = useActionState<Etat, FormData>(async (prec, f) => {
    const r = await deplacerIntervention(prec, f);
    if (r?.ok) setModifier(false);
    return r;
  }, null);
  const { date, heure } = isoVersParis(iv.debut);
  const fin = isoVersParis(iv.fin).heure;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titre-iv" onClick={fermer}>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-surface p-5 shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="titre-iv" className="font-display text-xl font-bold">
              {iv.demande?.client_nom ?? "Intervention"}
            </h2>
            <p className="text-sm text-muted">
              {jourLong(iv.debut)} · {heureFr(iv.debut)} – {heureFr(iv.fin)}
            </p>
          </div>
          <button type="button" onClick={fermer} className="inline-flex size-9 items-center justify-center rounded-md hover:bg-sunken" aria-label="Fermer">
            <X className="size-4" />
          </button>
        </div>

        <ul className="mb-4 space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: couleur }} /> {nomTech}
          </li>
          {iv.adresse && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-muted" />
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(iv.adresse)}`} target="_blank" rel="noreferrer" className="hover:underline">
                {iv.adresse}
              </a>
            </li>
          )}
          {iv.demande?.client_telephone && (
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-muted" />
              <a href={`tel:${iv.demande.client_telephone.replace(/\s/g, "")}`} className="tnum hover:underline">
                {iv.demande.client_telephone}
              </a>
            </li>
          )}
          {iv.demande?.message && <li className="rounded-md bg-sunken p-2 text-muted">{iv.demande.message}</li>}
        </ul>

        {etat?.ok && <Alert tone="ok" className="mb-3">{etat.message}</Alert>}
        {iv.statut === "terminee" ? (
          <Alert tone="ok" title="Intervention terminée">
            {iv.constat}
          </Alert>
        ) : (
          <div className="space-y-3">
            {peutTerminer && !modifier && <TerminerForm interventionId={iv.id} />}
            {gerant && !modifier && (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setModifier(true)}>
                Déplacer ou réattribuer
              </Button>
            )}
            {gerant && modifier && (
              <form action={action} className="space-y-3 rounded-md border border-border p-3">
                <input type="hidden" name="intervention_id" value={iv.id} />
                {etat && <Alert tone={etat.ok ? "ok" : "bad"}>{etat.message}</Alert>}
                <Field label="Technicien" htmlFor="dp_tech">
                  <Select id="dp_tech" name="technicien_id" defaultValue={iv.technicien_id}>
                    {techniciens
                      .filter((t) => t.disponible || t.id === iv.technicien_id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nom}
                        </option>
                      ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Field label="Date" htmlFor="dp_date" className="col-span-2 sm:col-span-1">
                    <Input id="dp_date" name="date" type="date" defaultValue={date} required />
                  </Field>
                  <Field label="Début" htmlFor="dp_debut">
                    <Input id="dp_debut" name="debut" type="time" defaultValue={heure} step={900} required />
                  </Field>
                  <Field label="Fin" htmlFor="dp_fin">
                    <Input id="dp_fin" name="fin" type="time" defaultValue={fin} step={900} required />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={enCours}>
                    {enCours ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                  <Button variant="ghost" onClick={() => setModifier(false)}>
                    Annuler
                  </Button>
                </div>
              </form>
            )}
            {gerant && (
              <Link href={`/demandes/${iv.demande_id}`} className="block text-sm font-semibold text-accent hover:underline">
                Ouvrir la demande
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
