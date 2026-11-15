import "server-only";
import { createAuthClient } from "./supabase/server";
import type { Etape } from "./format";

/**
 * Lectures avec la session de l'utilisateur connecté : la base applique les règles RLS
 * (une entreprise ne voit que ses données, un technicien que ses interventions).
 */

export interface DemandeListe {
  id: string;
  reference: string | null;
  client_nom: string | null;
  client_adresse: string | null;
  message: string | null;
  etape: Etape;
  statut: string | null;
  a_planifier_manuellement: boolean;
  donnees_fictives: boolean | null;
  type_demande: string | null;
  created_at: string;
}

export interface Ligne {
  designation: string;
  quantite?: number;
  prix_unitaire_ht?: number;
  total_ht?: number;
}

export interface DevisRow {
  id: string;
  numero: string;
  statut: "en_preparation" | "envoye" | "signe" | "refuse" | "expire" | "erreur";
  lignes: Ligne[];
  total_ht: number | null;
  tva_taux: number | null;
  montant_tva: number | null;
  total_ttc: number | null;
  valide_jusqu: string;
  avertissements: string[];
  infos_manquantes: string[];
  envoye_at: string | null;
  email_envoye: boolean;
  email_destinataire: string | null;
  signe_at: string | null;
  signataire_nom: string | null;
  signature_image: string | null;
  signature_ip: string | null;
  signature_user_agent: string | null;
  empreinte_sha256: string | null;
  refuse_at: string | null;
  refus_motif: string | null;
  created_at: string;
}

export interface InterventionRow {
  id: string;
  demande_id: string;
  technicien_id: string;
  debut: string;
  fin: string;
  adresse: string | null;
  statut: "planifiee" | "terminee" | "annulee";
  constat: string | null;
  travaux: string[];
  materiel: string[];
  terminee_at: string | null;
}

export interface FactureRow {
  id: string;
  numero: string;
  statut: "en_preparation" | "emise" | "erreur";
  lignes: Ligne[];
  total_ht: number | null;
  tva_taux: number | null;
  montant_tva: number | null;
  total_ttc: number | null;
  conditions_paiement: string | null;
  email_envoye: boolean;
  email_destinataire: string | null;
  emise_at: string | null;
}

export interface Technicien {
  id: string;
  nom: string;
  couleur: string | null;
  telephone: string | null;
  competences: string[];
  zone: string[];
  disponible: boolean;
}

export interface Fiche {
  demande: DemandeListe & { client_telephone: string | null; client_email: string | null; canal: string; planification_note: string | null };
  devis: DevisRow | null;
  intervention: (InterventionRow & { technicien: Technicien | null }) | null;
  facture: FactureRow | null;
  historique: { id: number; etape_avant: string | null; etape_apres: string; auteur_type: string; commentaire: string | null; created_at: string }[];
}

export const PAGE_TAILLE = 20;

const ETAPES_FILTRE: Record<string, Etape[]> = {
  en_cours: ["nouvelle", "devis_envoye", "devis_signe", "planifiee"],
  a_planifier: ["devis_signe"],
  terminees: ["terminee"],
  closes: ["refusee", "annulee"],
};

export async function listerDemandes(f: { filtre?: string; recherche?: string; page?: number }) {
  const db = await createAuthClient();
  const page = Math.max(1, f.page ?? 1);
  let q = db
    .from("demandes")
    .select("id, reference, client_nom, client_adresse, message, etape, statut, a_planifier_manuellement, donnees_fictives, type_demande, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_TAILLE, page * PAGE_TAILLE - 1);
  const etapes = f.filtre ? ETAPES_FILTRE[f.filtre] : undefined;
  if (etapes) q = q.in("etape", etapes);
  const r = f.recherche?.trim().replace(/[%,()]/g, " ").slice(0, 60);
  if (r) q = q.or(`client_nom.ilike.%${r}%,reference.ilike.%${r}%,message.ilike.%${r}%`);
  const { data, error, count } = await q;
  if (error) throw new Error(`Lecture des demandes impossible : ${error.message}`);
  return { lignes: (data ?? []) as DemandeListe[], total: count ?? 0, page };
}

export async function lireFiche(id: string): Promise<Fiche | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await createAuthClient();
  const { data: demande, error } = await db.from("demandes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Lecture de la demande impossible : ${error.message}`);
  if (!demande) return null;
  const [devis, intervention, facture, historique] = await Promise.all([
    db.from("devis").select("*").eq("demande_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("interventions").select("*, technicien:techniciens(*)").eq("demande_id", id).neq("statut", "annulee").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("factures").select("*").eq("demande_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("demande_historique").select("id, etape_avant, etape_apres, auteur_type, commentaire, created_at").eq("demande_id", id).order("id"),
  ]);
  return {
    demande: demande as Fiche["demande"],
    devis: (devis.data as DevisRow | null) ?? null,
    intervention: (intervention.data as Fiche["intervention"]) ?? null,
    facture: (facture.data as FactureRow | null) ?? null,
    historique: (historique.data as Fiche["historique"]) ?? [],
  };
}

export async function listerTechniciens(): Promise<Technicien[]> {
  const db = await createAuthClient();
  const { data, error } = await db.from("techniciens").select("id, nom, couleur, telephone, competences, zone, disponible, created_at").order("created_at").order("id");
  if (error) throw new Error(`Lecture des techniciens impossible : ${error.message}`);
  return (data ?? []) as Technicien[];
}

/** Comptes de connexion des techniciens (visible du gérant uniquement). */
export async function comptesTechniciens(): Promise<Record<string, boolean>> {
  const db = await createAuthClient();
  const { data } = await db.from("membres").select("technicien_id").eq("role", "technicien");
  return Object.fromEntries((data ?? []).filter((m) => m.technicien_id).map((m) => [m.technicien_id as string, true]));
}

export interface InterventionAgenda extends InterventionRow {
  demande: { reference: string | null; client_nom: string | null; client_telephone: string | null; message: string | null; etape: string } | null;
}

export async function interventionsEntre(debutIso: string, finIso: string): Promise<InterventionAgenda[]> {
  const db = await createAuthClient();
  const { data, error } = await db
    .from("interventions")
    .select("*, demande:demandes(reference, client_nom, client_telephone, message, etape)")
    .neq("statut", "annulee")
    .lt("debut", finIso)
    .gt("fin", debutIso)
    .order("debut");
  if (error) throw new Error(`Lecture de l'agenda impossible : ${error.message}`);
  return (data ?? []) as InterventionAgenda[];
}

export interface Entreprise {
  id: string;
  entreprise: string;
  gerant: string | null;
  telephone: string | null;
  email: string | null;
  siret: string | null;
  adresse: string | null;
  lien_avis_google: string | null;
  logo_url: string | null;
  validite_devis_jours: number | null;
}

export async function lireEntreprise(): Promise<Entreprise | null> {
  const db = await createAuthClient();
  const { data } = await db.from("artisans").select("id, entreprise, gerant, telephone, email, siret, adresse, lien_avis_google, logo_url, validite_devis_jours").maybeSingle();
  return (data as Entreprise | null) ?? null;
}
