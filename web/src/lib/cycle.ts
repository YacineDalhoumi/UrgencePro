import "server-only";
import { createAnonClient, createAuthClient } from "./supabase/server";
import { cleServeur, mockMode } from "./env";
import { nouveauJeton } from "./jeton";
import { heureFr, jourLong, parisVersIso } from "./format";
import { appelerAgent, type PayloadN8n, type ResultatAppel } from "./agent/n8n";
import { appelerAgentSimule } from "./agent/mock";
import { PlanningSchema, erreurAgent, type CodeErreur } from "./agent/types";
import type { ArtisanUser } from "./auth";

/**
 * Cycle de vie d'une demande : Nouvelle → Devis envoyé → Devis signé → Planifiée → Terminée.
 * Toutes les écritures passent par des fonctions SQL contrôlées (rôle, entreprise, jeton).
 */

const agent = (p: PayloadN8n): Promise<ResultatAppel> => (mockMode() ? appelerAgentSimule(p) : appelerAgent(p));

export type Issue =
  | { ok: true; demandeId: string; avertissement?: string }
  | { ok: false; code: CodeErreur | "base"; message: string; demandeId?: string };

export interface ClientSaisi {
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
}

interface DemandeCreee {
  demande_id: string;
  reference: string;
  devis_id: string;
  numero_devis: string;
  artisan_id: string;
}

/** Appelle l'agent « devis » pour une demande existante et enregistre le résultat. */
async function produireDevis(
  db: Awaited<ReturnType<typeof createAuthClient>>,
  d: DemandeCreee,
  jeton: string,
  origine: string,
  message: string,
  client: ClientSaisi,
  canal: "email" | "sms",
): Promise<Issue> {
  const res = await agent({
    message,
    type_demande: "devis",
    artisan_id: d.artisan_id,
    reference: d.reference,
    demande_id: d.demande_id,
    numero_devis: d.numero_devis,
    lien_signature: `${origine}/devis/${jeton}`,
    canal,
    client,
  });
  const succes = res.ok && res.data.success && !erreurAgent(res.data.resultat);
  const { error } = await db.rpc("enregistrer_devis", {
    p_devis_id: d.devis_id,
    p_resultat: res.ok ? (res.data.resultat ?? {}) : { erreur: res.message },
    p_actions: res.ok ? (res.data.actions ?? {}) : {},
    p_succes: succes,
    p_donnees_fictives: res.ok ? (res.data.donnees_fictives ?? true) : true,
  });
  if (error) return { ok: false, code: "base", message: `Le devis n'a pas pu être enregistré : ${error.message}`, demandeId: d.demande_id };
  if (!res.ok) return { ok: false, code: res.code, message: res.message, demandeId: d.demande_id };
  if (!succes) return { ok: false, code: "reponse_illisible", message: "L'agent n'a pas produit de devis exploitable. Relancez la création du devis depuis la fiche.", demandeId: d.demande_id };
  return { ok: true, demandeId: d.demande_id };
}

/** Gérant : nouvelle demande → fiche client → devis numéroté → envoi au client avec son lien de signature. */
export async function creerDemandeEtDevis(_user: ArtisanUser, saisie: { message: string; client: ClientSaisi; canal: "email" | "sms" }, origine: string): Promise<Issue> {
  const db = await createAuthClient();
  const { jeton, empreinte } = nouveauJeton();
  const { data, error } = await db.rpc("creer_demande", {
    p_message: saisie.message,
    p_client: saisie.client,
    p_canal: saisie.canal,
    p_token_hash: empreinte,
  });
  if (error || !data) return { ok: false, code: "base", message: error?.message ?? "La demande n'a pas pu être créée." };
  return produireDevis(db, data as DemandeCreee, jeton, origine, saisie.message, saisie.client, saisie.canal);
}

/** Gérant : nouvelle tentative de création du devis (même numéro, nouveau lien). */
export async function relancerDevis(demandeId: string, origine: string): Promise<Issue> {
  const db = await createAuthClient();
  const { jeton, empreinte } = nouveauJeton();
  const { data, error } = await db.rpc("relancer_devis", { p_demande_id: demandeId, p_token_hash: empreinte });
  if (error || !data) return { ok: false, code: "base", message: error?.message ?? "Relance impossible.", demandeId };
  const d = data as DemandeCreee & { message: string; canal: "email" | "sms"; client: Partial<ClientSaisi> };
  const client: ClientSaisi = { nom: d.client.nom ?? "", telephone: d.client.telephone ?? "", email: d.client.email ?? "", adresse: d.client.adresse ?? "" };
  return produireDevis(db, d, jeton, origine, d.message, client, d.canal);
}

// ——— Après signature : planification automatique (aucun utilisateur connecté) ———

interface ContextePlanning {
  artisan_id: string;
  demande_id: string;
  reference: string;
  numero_devis: string;
  message: string;
  canal: "email" | "sms";
  client: ClientSaisi;
  lignes: { designation?: string }[];
  deja_planifie: boolean;
  techniciens: { id: string; nom: string; disponible: boolean; competences: string[]; zone: string[] }[];
  creneaux_occupes: { technicien_id: string; debut: string; fin: string }[];
}

export type IssuePlanification = { statut: "planifiee"; technicien: string; debut: string; fin: string } | { statut: "a_planifier"; raison: string } | { statut: "ignore" };

/** Candidats proposés par l'agent planning (créneau principal puis alternatives), convertis en instants UTC. */
export function creneauxCandidats(resultat: unknown): { technicien_id: string; debut: string; fin: string }[] {
  const r = PlanningSchema.safeParse(resultat ?? {}).data;
  if (!r || r.action === "annuler") return [];
  const liste = [r.creneau_propose, ...r.alternatives].filter((c): c is NonNullable<typeof c> & object => !!c && typeof c === "object");
  const sortie: { technicien_id: string; debut: string; fin: string }[] = [];
  for (const c of liste) {
    if (!c.date || !c.heure_debut || !c.technicien_id) continue;
    const debut = parisVersIso(c.date, c.heure_debut);
    if (!debut) continue;
    const finSaisie = c.heure_fin ? parisVersIso(c.date, c.heure_fin) : null;
    const fin = finSaisie && finSaisie > debut ? finSaisie : new Date(new Date(debut).getTime() + 90 * 60_000).toISOString();
    sortie.push({ technicien_id: c.technicien_id, debut, fin });
  }
  return sortie;
}

export async function planifierApresSignature(jeton: string): Promise<IssuePlanification> {
  const db = createAnonClient();
  const cle = cleServeur();
  const { data, error } = await db.rpc("planning_contexte", { p_token: jeton, p_cle: cle });
  if (error) throw new Error(`Contexte de planification illisible : ${error.message}`);
  const ctx = data as ContextePlanning | null;
  if (!ctx || ctx.deja_planifie) return { statut: "ignore" };

  const signaler = async (raison: string): Promise<IssuePlanification> => {
    await db.rpc("signaler_a_planifier", { p_token: jeton, p_cle: cle, p_raison: raison });
    return { statut: "a_planifier", raison };
  };

  const travaux = ctx.lignes.map((l) => l.designation).filter(Boolean).join(", ");
  const res = await agent({
    message: `Planifier l'intervention du devis signé ${ctx.numero_devis}. Demande du client : ${ctx.message}${travaux ? `. Travaux prévus : ${travaux}` : ""}. Adresse : ${ctx.client.adresse || "non précisée"}. Proposer un créneau avec un technicien de l'entreprise (utiliser son identifiant exact).`,
    type_demande: "planning",
    artisan_id: ctx.artisan_id,
    reference: ctx.reference,
    demande_id: ctx.demande_id,
    canal: ctx.canal,
    client: ctx.client,
    creneaux_occupes: ctx.creneaux_occupes,
    techniciens: ctx.techniciens.map((t) => ({ id: t.id, nom: t.nom, disponible: t.disponible })),
  });
  if (!res.ok) return signaler(`L'agent planning n'a pas répondu (${res.message})`);
  if (!res.data.success) return signaler("L'agent planning n'a pas produit de proposition exploitable.");

  const candidats = creneauxCandidats(res.data.resultat);
  if (!candidats.length) return signaler("Aucun créneau n'a été proposé automatiquement.");

  let retenu: { technicien: string; debut: string; fin: string } | null = null;
  const refus: string[] = [];
  for (const c of candidats) {
    const { data: r, error: e } = await db.rpc("planifier_apres_signature", { p_token: jeton, p_cle: cle, p_technicien_id: c.technicien_id, p_debut: c.debut, p_fin: c.fin });
    if (e) throw new Error(`Planification impossible : ${e.message}`);
    const issue = r as { ok: boolean; raison?: string; technicien_nom?: string };
    if (issue.ok) {
      retenu = { technicien: issue.technicien_nom ?? c.technicien_id, debut: c.debut, fin: c.fin };
      break;
    }
    if (issue.raison === "deja_planifiee") return { statut: "ignore" };
    refus.push(issue.raison ?? "refusé");
  }
  if (!retenu) return signaler(`Les créneaux proposés n'étaient pas libres (${[...new Set(refus)].map((r) => RAISONS[r] ?? r).join(", ")}).`);

  // Confirmation au client (email en mode démo vers l'adresse de test) — un échec n'annule pas la planification
  const conf = await agent({
    message: `Envoyer au client la confirmation de son rendez-vous : ${jourLong(retenu.debut)} de ${heureFr(retenu.debut)} à ${heureFr(retenu.fin)}, avec le technicien ${retenu.technicien}, à l'adresse ${ctx.client.adresse || "indiquée"}. Devis ${ctx.numero_devis} signé. Message court et cordial (type_message : confirmation).`,
    type_demande: "communication",
    artisan_id: ctx.artisan_id,
    reference: ctx.reference,
    demande_id: ctx.demande_id,
    canal: ctx.canal,
    client: ctx.client,
  });
  if (!conf.ok) console.error(`[planification] confirmation non envoyée pour ${ctx.reference} : ${conf.message}`);
  return { statut: "planifiee", ...retenu };
}

export const RAISONS: Record<string, string> = {
  chevauchement: "le technicien est déjà occupé sur ce créneau",
  technicien_inconnu: "technicien inconnu",
  technicien_indisponible: "technicien indisponible",
  horaires_invalides: "horaires invalides",
  creneau_passe: "créneau déjà passé",
  demande_inconnue: "demande introuvable",
  deja_planifiee: "demande déjà planifiée",
  etape_terminee: "la demande est terminée",
  etape_annulee: "la demande est annulée",
  etape_refusee: "le devis a été refusé",
};

// ——— Intervention terminée → rapport et facture ———

interface ContexteFacture {
  facture_id: string;
  numero_facture: string;
  facture_statut: string;
  artisan_id: string;
  demande_id: string;
  reference: string;
  message: string;
  canal: "email" | "sms";
  client: Partial<ClientSaisi>;
  intervention: { date: string; technicien: string; adresse: string | null; constat: string; travaux: string[]; materiel: string[]; duree_minutes: number };
  devis: { numero: string; lignes: unknown[]; total_ht: number; tva_taux: number; total_ttc: number } | null;
}

export async function terminerEtFacturer(interventionId: string, saisie: { constat: string; travaux: string[]; materiel: string[] } | null): Promise<Issue> {
  const db = await createAuthClient();
  const { data, error } = await db.rpc("terminer_intervention", {
    p_intervention_id: interventionId,
    p_constat: saisie?.constat ?? null,
    p_travaux: saisie?.travaux ?? null,
    p_materiel: saisie?.materiel ?? null,
  });
  if (error || !data) return { ok: false, code: "base", message: error?.message ?? "Clôture impossible." };
  const ctx = data as ContexteFacture;
  if (ctx.facture_statut === "emise") return { ok: true, demandeId: ctx.demande_id };

  const client: ClientSaisi = { nom: ctx.client.nom ?? "", telephone: ctx.client.telephone ?? "", email: ctx.client.email ?? "", adresse: ctx.client.adresse ?? ctx.intervention.adresse ?? "" };
  const rappelDevis = ctx.devis
    ? ` Le devis signé ${ctx.devis.numero} prévoyait : ${JSON.stringify(ctx.devis.lignes)} (total TTC ${ctx.devis.total_ttc} €, TVA ${ctx.devis.tva_taux} %). Facturer selon ce devis, sauf travaux supplémentaires décrits.`
    : "";
  const res = await agent({
    message: `Intervention terminée pour la demande ${ctx.reference} : ${ctx.message}.${rappelDevis} Durée : ${ctx.intervention.duree_minutes} minutes.`,
    type_demande: "rapport_facture",
    artisan_id: ctx.artisan_id,
    reference: ctx.reference,
    demande_id: ctx.demande_id,
    numero_facture: ctx.numero_facture,
    canal: ctx.canal,
    client,
    intervention: {
      date: ctx.intervention.date,
      technicien: ctx.intervention.technicien,
      constat: ctx.intervention.constat,
      travaux: ctx.intervention.travaux,
      materiel: ctx.intervention.materiel,
    },
  });
  const succes = res.ok && res.data.success && !erreurAgent(res.data.resultat);
  const facture = res.ok ? ((res.data.resultat as { facture?: unknown } | null)?.facture ?? {}) : {};
  const { error: e } = await db.rpc("enregistrer_facture", {
    p_facture_id: ctx.facture_id,
    p_facture: facture,
    p_actions: res.ok ? (res.data.actions ?? {}) : {},
    p_succes: succes,
  });
  if (e) return { ok: false, code: "base", message: `La facture n'a pas pu être enregistrée : ${e.message}`, demandeId: ctx.demande_id };
  if (!res.ok) return { ok: false, code: res.code, message: res.message, demandeId: ctx.demande_id };
  if (!succes) return { ok: false, code: "reponse_illisible", message: "L'agent n'a pas produit de facture exploitable. Réessayez depuis la fiche.", demandeId: ctx.demande_id };
  return { ok: true, demandeId: ctx.demande_id };
}
