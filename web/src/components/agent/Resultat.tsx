// Affichage d'un résultat d'agent, adapté à chaque type. Utilisé après un envoi et dans la fiche d'historique.
import { CalendarCheck, CalendarX, FileText, Mail, MailX, TriangleAlert, Info, UserRound, Clock, Euro, CircleHelp } from "lucide-react";
import { Alert, Badge, Card, CardTitle, cn, type Tone } from "@/components/ui";
import { CopyButton } from "./CopyButton";
import {
  ActionsSchema, CommunicationSchema, DevisSchema, PlanningSchema, PriseEnChargeSchema, RapportFactureSchema, TYPE_LABEL, erreurAgent,
  type Actions, type Creneau, type Ligne, type TypeDemande,
} from "@/lib/agent/types";

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);
const pct = (n: number) => `${String(n).replace(".", ",")} %`;
const dateFr = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};

export interface ResultatProps {
  success: boolean;
  reference?: string | null;
  typeDemande?: string | null;
  resultat?: Record<string, unknown> | null;
  actions?: Record<string, unknown> | null;
  donneesFictives?: boolean | null;
  routage?: { confiance?: number | null; raison?: string } | null;
  typeChoisi?: "auto" | TypeDemande;
  dureeMs?: number;
}

export function ResultatAgent(p: ResultatProps) {
  const type = (p.typeDemande ?? "") as TypeDemande;
  const err = erreurAgent(p.resultat);
  const actions = ActionsSchema.safeParse(p.actions ?? {}).data ?? {};
  return (
    <div className="space-y-4">
      {p.donneesFictives && (
        <div className="flex items-center gap-2 rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-sm font-semibold text-warn" role="status">
          <TriangleAlert className="size-4 shrink-0" /> Données fictives – mode démo
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {type in TYPE_LABEL && <Badge tone="accent">{TYPE_LABEL[type]}</Badge>}
        {p.reference && <span className="font-mono text-sm text-muted">{p.reference}</span>}
        {p.dureeMs ? <span className="text-sm text-muted">· traité en {Math.round(p.dureeMs / 1000)} s</span> : null}
      </div>
      {p.routage?.raison && (
        <p className="text-sm text-muted">
          Type choisi par le routeur IA{p.routage.confiance != null ? ` (confiance ${Math.round(Number(p.routage.confiance) * 100)} %)` : ""} : {p.routage.raison}
        </p>
      )}

      {err || !p.success ? (
        <Alert tone="bad" title="L'agent n'a pas produit de résultat exploitable">
          <p>{err?.erreur ?? "Le traitement s'est terminé en erreur."} Reformulez la demande ou réessayez ; si le problème persiste, consultez l’exécution dans n8n.</p>
          {err?.brut && (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">Voir la réponse brute</summary>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-surface p-2 font-mono text-xs">{err.brut}</pre>
            </details>
          )}
        </Alert>
      ) : (
        <>
          {type === "prise_en_charge" && <PriseEnCharge r={p.resultat} />}
          {type === "devis" && <Devis r={p.resultat} />}
          {type === "rapport_facture" && <RapportFacture r={p.resultat} />}
          {type === "communication" && <Communication r={p.resultat} />}
          {type === "planning" && <Planning r={p.resultat} actions={actions} />}
          {!(type in TYPE_LABEL) && <Alert tone="warn" title="Type de résultat inconnu">L’agent a renvoyé le type « {type || "vide"} ». Le contenu brut est affiché ci-dessous.</Alert>}
        </>
      )}

      <ActionsFaites a={actions} type={type} />

      <details className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
        <summary className="cursor-pointer font-semibold text-muted">Voir le JSON renvoyé par l’agent</summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded bg-sunken p-2 font-mono text-xs">{JSON.stringify({ resultat: p.resultat, actions: p.actions }, null, 2)}</pre>
      </details>
    </div>
  );
}

// ——— Éléments communs ———

function Liste({ items, tone, title, icon: Icon }: { items: string[]; tone: Tone; title: string; icon: typeof Info }) {
  if (!items.length) return null;
  return (
    <Alert tone={tone} title={title}>
      <ul className="space-y-0.5">
        {items.map((i, k) => (
          <li key={k} className="flex gap-1.5">
            <Icon className="mt-0.5 size-4 shrink-0" /> {i}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
const InfosManquantes = ({ items }: { items: string[] }) => <Liste items={items} tone="warn" title="Informations manquantes" icon={CircleHelp} />;
const Avertissements = ({ items }: { items: string[] }) => <Liste items={items} tone="bad" title="Avertissements" icon={TriangleAlert} />;

function MessageClient({ texte, titre = "Message pour le client" }: { texte: string; titre?: string }) {
  if (!texte) return null;
  return (
    <Card>
      <CardTitle action={<CopyButton text={texte} />}>{titre}</CardTitle>
      <p className="whitespace-pre-line px-4 pb-4 text-sm leading-relaxed">{texte}</p>
    </Card>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: typeof Info }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-md bg-sunken p-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted" />
      <div className="min-w-0">
        <div className="label-caps text-muted">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}

function TableLignes({ lignes, totaux }: { lignes: Ligne[]; totaux: { ht: number; taux: number; tva: number; ttc: number } }) {
  return (
    <>
      {/* Tableau sur grand écran, cartes empilées sur téléphone */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-sunken text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-semibold">Désignation</th>
              <th className="px-3 py-2 text-right font-semibold">Qté</th>
              <th className="px-3 py-2 text-right font-semibold">PU HT</th>
              <th className="px-4 py-2 text-right font-semibold">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2">{l.designation}</td>
                <td className="px-3 py-2 text-right tnum">{l.quantite}</td>
                <td className="px-3 py-2 text-right tnum">{eur(l.prix_unitaire_ht)}</td>
                <td className="px-4 py-2 text-right font-semibold tnum">{eur(l.total_ht || l.quantite * l.prix_unitaire_ht)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border sm:hidden">
        {lignes.map((l, i) => (
          <li key={i} className="px-4 py-2 text-sm">
            <div className="font-semibold">{l.designation}</div>
            <div className="flex justify-between text-muted tnum">
              <span>
                {l.quantite} × {eur(l.prix_unitaire_ht)}
              </span>
              <span className="font-semibold text-fg">{eur(l.total_ht || l.quantite * l.prix_unitaire_ht)}</span>
            </div>
          </li>
        ))}
      </ul>
      <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-6 gap-y-1 border-t border-border px-4 py-3 text-sm tnum">
        <dt className="text-muted">Total HT</dt>
        <dd className="text-right">{eur(totaux.ht)}</dd>
        <dt className="text-muted">TVA {pct(totaux.taux)}</dt>
        <dd className="text-right">{eur(totaux.tva)}</dd>
        <dt className="font-display text-base font-bold">Total TTC</dt>
        <dd className="text-right font-display text-base font-bold">{eur(totaux.ttc)}</dd>
      </dl>
    </>
  );
}

// ——— Prise en charge ———

const URGENCE: Record<string, { tone: Tone; label: string }> = {
  critique: { tone: "bad", label: "Urgence critique" },
  haute: { tone: "warn", label: "Urgence haute" },
  normale: { tone: "ok", label: "Urgence normale" },
};

const LIBELLES: Record<string, string> = { nom: "Nom", telephone: "Téléphone", email: "Email", adresse: "Adresse", probleme: "Problème" };

function PriseEnCharge({ r }: { r: unknown }) {
  const d = PriseEnChargeSchema.parse(r ?? {});
  const u = URGENCE[d.urgence] ?? URGENCE.normale;
  const infos = Object.entries(d.infos_collectees).filter(([, v]) => v !== "" && v != null);
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className={cn("inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold text-white", u.tone === "bad" ? "bg-bad" : u.tone === "warn" ? "bg-warn" : "bg-ok")}>
          <span className="size-2 rounded-full bg-white" /> {u.label}
        </div>
        {d.type_probleme && <p className="mt-3 font-display text-lg font-bold">{d.type_probleme}</p>}
        {d.resume && <p className="mt-1 text-sm">{d.resume}</p>}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat icon={UserRound} label="Technicien suggéré" value={d.technicien_suggere?.nom || "—"} />
          <Stat icon={Clock} label="Délai estimé" value={d.delai_estime_minutes != null ? `${d.delai_estime_minutes} min` : "—"} />
          <Stat icon={Euro} label="Prix indicatif HT" value={d.fourchette_prix_indicative_ht ? `${eur(d.fourchette_prix_indicative_ht.min)} – ${eur(d.fourchette_prix_indicative_ht.max)}` : "—"} />
        </div>
        {d.technicien_suggere?.raison && <p className="mt-2 text-sm text-muted">Pourquoi : {d.technicien_suggere.raison}</p>}
        {infos.length > 0 && (
          <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            {infos.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{LIBELLES[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ")}</dt>
                <dd className="break-words">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
      <InfosManquantes items={d.infos_manquantes} />
      <MessageClient texte={d.message_client} />
    </div>
  );
}

// ——— Devis ———

function Devis({ r }: { r: unknown }) {
  const d = DevisSchema.parse(r ?? {});
  return (
    <div className="space-y-4">
      <Avertissements items={d.avertissements} />
      <InfosManquantes items={d.infos_manquantes} />
      <Card className="overflow-hidden">
        <CardTitle action={d.validite_jours ? <Badge>Valable {d.validite_jours} jours</Badge> : undefined}>Devis {d.numero_devis}</CardTitle>
        {d.majorations_appliquees.length > 0 && <p className="px-4 pb-2 text-sm text-accent">Majorations : {d.majorations_appliquees.join(", ")}</p>}
        <TableLignes lignes={d.lignes} totaux={{ ht: d.total_ht, taux: d.tva_taux, tva: d.montant_tva, ttc: d.total_ttc }} />
      </Card>
      <MessageClient texte={d.message_client} />
    </div>
  );
}

// ——— Rapport et facture ———

function Puces({ titre, items }: { titre: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="label-caps mt-3 text-muted">{titre}</h3>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {items.map((i, k) => (
          <li key={k}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function RapportFacture({ r }: { r: unknown }) {
  const d = RapportFactureSchema.parse(r ?? {});
  const rap = d.rapport;
  const f = d.facture;
  return (
    <div className="space-y-4">
      <InfosManquantes items={d.infos_manquantes} />
      <Card>
        <CardTitle>Rapport d’intervention</CardTitle>
        <div className="px-4 pb-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            {[
              ["Date", /^\d{4}-\d{2}-\d{2}$/.test(rap.date_intervention) ? new Date(`${rap.date_intervention}T12:00:00`).toLocaleDateString("fr-FR", { dateStyle: "long" }) : rap.date_intervention],
              ["Technicien", rap.technicien],
              ["Adresse", rap.adresse],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {rap.constat && (
            <>
              <h3 className="label-caps mt-3 text-muted">Constat</h3>
              <p className="mt-1 text-sm">{rap.constat}</p>
            </>
          )}
          <Puces titre="Travaux réalisés" items={rap.travaux_realises} />
          <Puces titre="Matériel posé" items={rap.materiel_pose} />
          <Puces titre="Recommandations" items={rap.recommandations} />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <CardTitle action={f.conditions_paiement ? <Badge>{f.conditions_paiement}</Badge> : undefined}>Facture {f.numero}</CardTitle>
        <TableLignes lignes={f.lignes} totaux={{ ht: f.total_ht, taux: f.tva_taux, tva: f.montant_tva, ttc: f.total_ttc }} />
      </Card>
      <MessageClient texte={d.message_client} />
    </div>
  );
}

// ——— Communication ———

const TYPE_MESSAGE: Record<string, string> = { confirmation: "Confirmation", relance_devis: "Relance de devis", demande_avis: "Demande d’avis", suivi: "Suivi" };

function Communication({ r }: { r: unknown }) {
  const d = CommunicationSchema.parse(r ?? {});
  const dest = typeof d.destinataire === "string" ? d.destinataire : [d.destinataire?.nom, d.destinataire?.email || d.destinataire?.telephone].filter(Boolean).join(" · ");
  return (
    <div className="space-y-4">
      <InfosManquantes items={d.infos_manquantes} />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-sunken px-4 py-2.5 text-sm">
          <Badge tone="info">{TYPE_MESSAGE[d.type_message] ?? (d.type_message || "Message")}</Badge>
          <Badge>{d.canal === "email" ? "Email" : d.canal}</Badge>
          <Badge tone={d.a_envoyer ? "ok" : "warn"}>{d.a_envoyer ? "Prêt à envoyer" : "À compléter avant envoi"}</Badge>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-border px-4 py-3 text-sm">
          <dt className="text-muted">À</dt>
          <dd className="break-words">{dest || "—"}</dd>
          <dt className="text-muted">Objet</dt>
          <dd className="font-semibold">{d.objet || "—"}</dd>
        </dl>
        <div className="flex justify-end px-4 pt-2">
          <CopyButton text={`${d.objet}\n\n${d.contenu}`} />
        </div>
        <p className="whitespace-pre-line px-4 pb-4 text-sm leading-relaxed">{d.contenu}</p>
      </Card>
    </div>
  );
}

// ——— Planning ———

const ACTION_PLANNING: Record<string, string> = { proposer: "Créneau proposé", reporter: "Report proposé", annuler: "Annulation" };

function CreneauLigne({ c }: { c: Creneau | string }) {
  if (typeof c === "string") return <span>{c}</span>;
  return (
    <span>
      <b className="capitalize">{c.date ? dateFr(c.date) : "Date à définir"}</b>
      {c.heure_debut && ` · ${c.heure_debut.replace(":", " h ")}${c.heure_fin ? ` – ${c.heure_fin.replace(":", " h ")}` : ""}`}
      {c.technicien_nom && <span className="text-muted"> · {c.technicien_nom}</span>}
    </span>
  );
}

function Planning({ r, actions }: { r: unknown; actions: Actions }) {
  const d = PlanningSchema.parse(r ?? {});
  const c = d.creneau_propose;
  const lien = actions.evenement_agenda && /^https?:\/\//.test(actions.evenement_agenda) ? actions.evenement_agenda : null;
  return (
    <div className="space-y-4">
      <Avertissements items={d.avertissements} />
      <InfosManquantes items={d.infos_manquantes} />
      <Card className="p-4">
        <div className="label-caps text-muted">{ACTION_PLANNING[d.action] ?? d.action}</div>
        {c && (c.date || c.heure_debut) ? (
          <div className="mt-1">
            <div className="font-display text-xl font-extrabold capitalize">{c.date ? dateFr(c.date) : "—"}</div>
            <div className="text-lg font-semibold tnum">
              {c.heure_debut?.replace(":", " h ")}
              {c.heure_fin && ` – ${c.heure_fin.replace(":", " h ")}`}
            </div>
            {c.technicien_nom && <p className="mt-1 text-sm text-muted">Technicien : {c.technicien_nom}</p>}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">Aucun créneau proposé.</p>
        )}
        {lien && (
          <a href={lien} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
            <CalendarCheck className="size-4" /> Ouvrir l’événement dans Google Agenda
          </a>
        )}
        {d.alternatives.length > 0 && (
          <>
            <h3 className="label-caps mt-4 text-muted">Alternatives</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {d.alternatives.map((a, i) => (
                <li key={i}>
                  <CreneauLigne c={a} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <MessageClient texte={d.message_client} />
    </div>
  );
}

// ——— Ce qui a été fait ———

function ActionsFaites({ a, type }: { a: Actions; type: TypeDemande }) {
  const lienAgenda = a.evenement_agenda && /^https?:\/\//.test(a.evenement_agenda) ? a.evenement_agenda : null;
  const items = [
    {
      ok: !!a.pdf,
      icon: FileText,
      texte: a.pdf ? `PDF généré : ${a.pdf}` : "Aucun PDF généré",
      visible: type === "devis" || type === "rapport_facture" || !!a.pdf,
    },
    { ok: !!a.email_envoye, icon: a.email_envoye ? Mail : MailX, texte: a.email_envoye ? `Email envoyé à ${a.email_destinataire ?? "destinataire inconnu"}` : "Aucun email envoyé", visible: true },
    {
      ok: !!a.evenement_agenda,
      icon: a.evenement_agenda ? CalendarCheck : CalendarX,
      texte: a.evenement_agenda ? "Événement créé dans Google Agenda" : "Aucun événement d’agenda créé",
      visible: type === "planning" || !!a.evenement_agenda,
      lien: lienAgenda,
    },
  ].filter((i) => i.visible);
  return (
    <Card>
      <CardTitle>Ce qui a été fait</CardTitle>
      <ul className="space-y-2 px-4 pb-4 text-sm">
        {items.map((i, k) => (
          <li key={k} className={cn("flex items-start gap-2", !i.ok && "text-muted")}>
            <i.icon className={cn("mt-0.5 size-4 shrink-0", i.ok ? "text-ok" : "text-muted")} />
            <span className="min-w-0 break-words">
              {i.texte}
              {i.lien && (
                <>
                  {" "}
                  ·{" "}
                  <a href={i.lien} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                    ouvrir
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      {a.pdf && <p className="px-4 pb-4 text-xs text-muted">Le PDF est joint à l’email ; il n’est pas encore stocké dans l’application.</p>}
    </Card>
  );
}
