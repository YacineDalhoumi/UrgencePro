import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Check, ChevronLeft, FileSignature, Mail, MapPin, Phone, TriangleAlert, UserRound } from "lucide-react";
import { requireGerant } from "@/lib/auth";
import { lireFiche, listerTechniciens, type Fiche, type Ligne as LigneDb } from "@/lib/donnees";
import { AUTEUR, jourParis, dateHeure, dateLongue, etapeInfo, heureFr, isoVersParis, jourLong } from "@/lib/format";
import { LigneSchema } from "@/lib/agent/types";
import { Alert, Badge, Card, CardTitle, cn } from "@/components/ui";
import { TableLignes } from "@/components/agent/Resultat";
import { BoutonAgent } from "@/components/cycle/BoutonAgent";
import { TerminerForm } from "@/components/cycle/TerminerForm";
import { PlanifierForm } from "@/components/cycle/PlanifierForm";
import { AnnulerForm } from "@/components/cycle/AnnulerForm";

export const metadata: Metadata = { title: "Demande" };

const PARCOURS = [
  { etape: "nouvelle", label: "Demande" },
  { etape: "devis_envoye", label: "Devis envoyé" },
  { etape: "devis_signe", label: "Signé" },
  { etape: "planifiee", label: "Planifiée" },
  { etape: "terminee", label: "Terminée" },
] as const;

const lignesPropres = (l: LigneDb[] | null | undefined) => (l ?? []).map((x) => LigneSchema.parse(x));

function Parcours({ etape }: { etape: string }) {
  const rang = PARCOURS.findIndex((p) => p.etape === etape);
  const arrete = etape === "refusee" || etape === "annulee";
  return (
    <ol className="mb-6 grid grid-cols-5 gap-1" aria-label="Avancement">
      {PARCOURS.map((p, i) => {
        const fait = !arrete && i <= rang;
        return (
          <li key={p.etape} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", fait ? "bg-accent" : "bg-sunken")} />
            <p className={cn("mt-1 truncate text-[11px] font-semibold sm:text-xs", fait ? "text-fg" : "text-muted")} aria-current={i === rang ? "step" : undefined}>
              {p.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** L'action principale de l'écran, selon l'étape. */
function ActionPrincipale({ f, techniciens }: { f: Fiche; techniciens: Awaited<ReturnType<typeof listerTechniciens>> }) {
  const { demande: d, devis, intervention, facture } = f;
  const demain = jourParis(1);

  if (d.etape === "annulee" || d.etape === "refusee") {
    return (
      <Alert tone="neutral" title={d.etape === "refusee" ? "Devis refusé par le client" : "Demande annulée"}>
        {devis?.refus_motif ? `Motif : ${devis.refus_motif}` : "Aucune action n’est attendue."}
      </Alert>
    );
  }
  if (!devis) {
    // Demande enregistrée avant la mise en place du suivi des devis (ancien formulaire)
    return <Alert tone="neutral" title="Demande traitée par l’agent">Cette demande a été enregistrée avant le suivi des devis : aucune action n’est attendue.</Alert>;
  }
  if (devis.statut === "erreur" || (devis.statut === "en_preparation" && d.statut === "erreur")) {
    return (
      <div className="space-y-3">
        <Alert tone="bad" title="Le devis n’a pas pu être envoyé">
          Relancez la création : le même numéro de devis est conservé et un nouveau lien de signature est envoyé au client.
        </Alert>
        <BoutonAgent url={`/api/demandes/${d.id}/devis`} libelle="Relancer la création du devis" attente="Le devis est en cours de création" />
      </div>
    );
  }
  if (devis.statut === "en_preparation") {
    return <Alert tone="info" title="Devis en cours de création">Rechargez la page dans quelques secondes.</Alert>;
  }
  if (devis.statut === "envoye") {
    return (
      <Alert tone="accent" title="En attente de la signature du client">
        Le devis a été envoyé{devis.email_destinataire ? ` à ${devis.email_destinataire}` : ""} le {dateHeure(devis.envoye_at ?? devis.created_at)}. Il est valable jusqu’au {dateLongue(devis.valide_jusqu)}.
      </Alert>
    );
  }
  if (devis.statut === "expire") {
    return <Alert tone="warn" title="Devis expiré">Le client n’a pas signé avant le {dateLongue(devis.valide_jusqu)}. Créez une nouvelle demande si besoin.</Alert>;
  }
  if (d.etape === "devis_signe" && !intervention) {
    return (
      <div className="space-y-3">
        {d.a_planifier_manuellement ? (
          <Alert tone="warn" title="À planifier manuellement">
            {d.planification_note ?? "Aucun créneau n’a pu être trouvé automatiquement."}
          </Alert>
        ) : (
          <Alert tone="info" title="Planification en cours">
            Le devis vient d’être signé : l’intervention est en train d’être planifiée automatiquement. Vous pouvez aussi la planifier vous-même.
          </Alert>
        )}
        <PlanifierForm demandeId={d.id} techniciens={techniciens} jourDefaut={demain} />
      </div>
    );
  }
  if (intervention?.statut === "planifiee") {
    return (
      <div className="space-y-3">
        <Alert tone="info" title={`Intervention prévue ${jourLong(intervention.debut).toLowerCase()} à ${heureFr(intervention.debut)}`}>
          Avec {intervention.technicien?.nom ?? "le technicien"}. Une fois sur place et le travail fini, saisissez le compte rendu : la facture part automatiquement.
        </Alert>
        <TerminerForm interventionId={intervention.id} />
      </div>
    );
  }
  if (intervention?.statut === "terminee" && facture?.statut !== "emise") {
    return (
      <div className="space-y-3">
        <Alert tone="bad" title="La facture n’a pas pu être envoyée">
          L’intervention est bien enregistrée comme terminée. Relancez l’envoi : le numéro de facture {facture?.numero} est conservé.
        </Alert>
        <BoutonAgent url={`/api/interventions/${intervention.id}/terminer`} libelle="Relancer la facture" attente="La facture est en cours de création" />
      </div>
    );
  }
  if (facture?.statut === "emise") {
    return (
      <Alert tone="ok" title="Demande terminée">
        Facture {facture.numero} envoyée{facture.email_destinataire ? ` à ${facture.email_destinataire}` : ""} le {dateHeure(facture.emise_at!)}, avec le remerciement et la demande d’avis.
      </Alert>
    );
  }
  return null;
}

export default async function PageDemande({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> }) {
  const { id } = await params;
  const { cree } = await searchParams;
  await requireGerant(`/demandes/${id}`);
  let f: Fiche | null;
  let techniciens: Awaited<ReturnType<typeof listerTechniciens>> = [];
  try {
    [f, techniciens] = await Promise.all([lireFiche(id), listerTechniciens()]);
  } catch (e) {
    return (
      <Alert tone="bad" title="Demande indisponible">
        {(e as Error).message}
      </Alert>
    );
  }
  if (!f) notFound();
  const { demande: d, devis, intervention, facture, historique } = f;
  const e = etapeInfo(d.etape);

  return (
    <>
      <Link href="/demandes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ChevronLeft className="size-4" /> Demandes
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-extrabold">{d.client_nom || "Client sans nom"}</h1>
        <Badge tone={e.tone}>{e.label}</Badge>
        {d.donnees_fictives && <Badge tone="warn">Démo</Badge>}
      </div>
      <p className="-mt-3 mb-5 text-sm text-muted tnum">
        {d.reference} · reçue le {dateHeure(d.created_at)}
      </p>

      {cree && devis?.statut === "envoye" && (
        <Alert tone="ok" title="Devis envoyé" className="mb-4">
          Le client a reçu le devis {devis.numero} par email, avec son lien de signature.
        </Alert>
      )}

      <Parcours etape={d.etape} />

      <section className="mb-6" aria-label="Action à faire">
        <ActionPrincipale f={f} techniciens={techniciens} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="min-w-0 space-y-4">
          {devis && devis.statut !== "en_preparation" && devis.statut !== "erreur" && (
            <Card className="overflow-hidden">
              <CardTitle action={<span className="text-sm font-semibold text-muted tnum">{devis.numero}</span>}>Devis</CardTitle>
              <TableLignes
                lignes={lignesPropres(devis.lignes)}
                totaux={{ ht: Number(devis.total_ht), taux: Number(devis.tva_taux), tva: Number(devis.montant_tva), ttc: Number(devis.total_ttc) }}
              />
              {devis.avertissements?.length > 0 && (
                <div className="border-t border-border px-4 py-3">
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-warn">
                    <TriangleAlert className="size-4" /> À vérifier
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
                    {devis.avertissements.map((a, i) => (
                      <li key={i}>{String(a)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {devis.statut === "signe" && (
                <div className="border-t border-border bg-ok-soft/40 px-4 py-3 text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-ok">
                    <FileSignature className="size-4" /> Signé par {devis.signataire_nom} le {dateHeure(devis.signe_at!)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-4">
                    {devis.signature_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={devis.signature_image} alt={`Signature de ${devis.signataire_nom}`} className="h-20 rounded border border-border bg-white p-1" />
                    )}
                    <details className="text-xs text-muted">
                      <summary className="cursor-pointer font-semibold">Preuve de signature</summary>
                      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                        <dt>Adresse IP</dt>
                        <dd className="tnum">{devis.signature_ip ?? "non transmise"}</dd>
                        <dt>Navigateur</dt>
                        <dd className="break-all">{devis.signature_user_agent ?? "—"}</dd>
                        <dt>Empreinte</dt>
                        <dd className="break-all font-mono">{devis.empreinte_sha256}</dd>
                      </dl>
                    </details>
                  </div>
                </div>
              )}
            </Card>
          )}

          {intervention && (
            <Card>
              <CardTitle>Intervention</CardTitle>
              <div className="space-y-1.5 px-4 pb-4 text-sm">
                <p className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-muted" />
                  {jourLong(intervention.debut)}, {heureFr(intervention.debut)} – {heureFr(intervention.fin)}
                </p>
                <p className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-full" style={{ background: intervention.technicien?.couleur ?? "var(--muted)" }} />
                  {intervention.technicien?.nom ?? "Technicien"}
                </p>
                {intervention.statut === "terminee" && (
                  <div className="mt-2 rounded-md bg-sunken p-3">
                    <p className="font-semibold">Compte rendu</p>
                    <p className="mt-1 whitespace-pre-line">{intervention.constat}</p>
                    {intervention.travaux?.length > 0 && <p className="mt-1 text-muted">Travaux : {intervention.travaux.join(", ")}</p>}
                    {intervention.materiel?.length > 0 && <p className="text-muted">Matériel : {intervention.materiel.join(", ")}</p>}
                  </div>
                )}
                {intervention.statut === "planifiee" && (
                  <Link href={`/agenda?semaine=${isoVersParis(intervention.debut).date}`} className="inline-block font-semibold text-accent hover:underline">
                    Voir dans l’agenda
                  </Link>
                )}
              </div>
            </Card>
          )}

          {facture?.statut === "emise" && (
            <Card className="overflow-hidden">
              <CardTitle action={<span className="text-sm font-semibold text-muted tnum">{facture.numero}</span>}>Facture</CardTitle>
              <TableLignes
                lignes={lignesPropres(facture.lignes)}
                totaux={{ ht: Number(facture.total_ht), taux: Number(facture.tva_taux), tva: Number(facture.montant_tva), ttc: Number(facture.total_ttc) }}
              />
              {facture.conditions_paiement && <p className="border-t border-border px-4 py-3 text-sm text-muted">{facture.conditions_paiement}</p>}
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardTitle>Client</CardTitle>
            <ul className="space-y-1.5 px-4 pb-4 text-sm">
              <li className="flex items-center gap-2">
                <UserRound className="size-4 shrink-0 text-muted" /> {d.client_nom || "—"}
              </li>
              {d.client_telephone && (
                <li className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0 text-muted" />
                  <a href={`tel:${d.client_telephone.replace(/\s/g, "")}`} className="tnum hover:underline">
                    {d.client_telephone}
                  </a>
                </li>
              )}
              {d.client_email && (
                <li className="flex items-center gap-2 break-all">
                  <Mail className="size-4 shrink-0 text-muted" /> {d.client_email}
                </li>
              )}
              {d.client_adresse && (
                <li className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-muted" /> {d.client_adresse}
                </li>
              )}
            </ul>
          </Card>
          <Card>
            <CardTitle>Demande</CardTitle>
            <p className="whitespace-pre-line px-4 pb-4 text-sm">{d.message}</p>
          </Card>
          {historique.length > 0 && (
            <Card>
              <CardTitle>Historique</CardTitle>
              <ol className="space-y-2.5 px-4 pb-4 text-sm">
                {historique.map((h) => (
                  <li key={h.id} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                    <div className="min-w-0">
                      <p className="font-semibold">{etapeInfo(h.etape_apres).label}</p>
                      <p className="text-xs text-muted tnum">
                        {dateHeure(h.created_at)} · {AUTEUR[h.auteur_type] ?? h.auteur_type}
                        {h.commentaire ? ` · ${h.commentaire}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {!["terminee", "annulee", "refusee"].includes(d.etape) && <AnnulerForm demandeId={d.id} />}
        </div>
      </div>
    </>
  );
}
