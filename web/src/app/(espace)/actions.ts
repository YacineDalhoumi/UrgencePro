"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/server";
import { parisVersIso } from "@/lib/format";
import { RAISONS } from "@/lib/cycle";

export type Etat = { ok: boolean; message: string; motDePasse?: string } | null;

const gerant = async () => {
  const u = await getCurrentUser();
  return u?.role === "gerant" ? u : null;
};

const texteErreur = (e: { code?: string; message: string }) => {
  if (e.code === "23P01") return "Ce technicien a déjà une intervention sur ce créneau.";
  if (e.code === "23514") return "Les horaires sont invalides : la fin doit être après le début.";
  if (e.code === "42501") return "Action non autorisée pour votre compte.";
  return e.message;
};

function creneau(f: FormData): { debut: string; fin: string } | string {
  const date = String(f.get("date") ?? "");
  const debut = parisVersIso(date, String(f.get("debut") ?? ""));
  const fin = parisVersIso(date, String(f.get("fin") ?? ""));
  if (!debut || !fin) return "Indiquez la date, l’heure de début et l’heure de fin.";
  if (fin <= debut) return "L’heure de fin doit être après l’heure de début.";
  return { debut, fin };
}

/** Gérant : planifie à la main une demande au devis signé (alerte « À planifier manuellement »). */
export async function planifierManuellement(_: Etat, f: FormData): Promise<Etat> {
  if (!(await gerant())) return { ok: false, message: "Action réservée au gérant." };
  const c = creneau(f);
  if (typeof c === "string") return { ok: false, message: c };
  const demandeId = String(f.get("demande_id") ?? "");
  const db = await createAuthClient();
  const { data, error } = await db.rpc("planifier_manuellement", { p_demande_id: demandeId, p_technicien_id: String(f.get("technicien_id") ?? ""), p_debut: c.debut, p_fin: c.fin });
  if (error) return { ok: false, message: texteErreur(error) };
  const r = data as { ok: boolean; raison?: string };
  if (!r.ok) return { ok: false, message: `Impossible de planifier : ${RAISONS[r.raison ?? ""] ?? r.raison}.` };
  revalidatePath(`/demandes/${demandeId}`);
  revalidatePath("/agenda");
  return { ok: true, message: "Intervention planifiée." };
}

/** Gérant : déplace ou réattribue une intervention (la base refuse tout chevauchement). */
export async function deplacerIntervention(_: Etat, f: FormData): Promise<Etat> {
  if (!(await gerant())) return { ok: false, message: "Seul le gérant peut déplacer une intervention." };
  const c = creneau(f);
  if (typeof c === "string") return { ok: false, message: c };
  const db = await createAuthClient();
  const { data, error } = await db
    .from("interventions")
    .update({ technicien_id: String(f.get("technicien_id") ?? ""), debut: c.debut, fin: c.fin })
    .eq("id", String(f.get("intervention_id") ?? ""))
    .eq("statut", "planifiee")
    .select("id, demande_id");
  if (error) return { ok: false, message: texteErreur(error) };
  if (!data?.length) return { ok: false, message: "Intervention introuvable ou déjà terminée." };
  revalidatePath("/agenda");
  revalidatePath(`/demandes/${data[0].demande_id}`);
  return { ok: true, message: "Intervention mise à jour." };
}

/** Gérant : annule une demande (et son intervention prévue). */
export async function annulerDemande(_: Etat, f: FormData): Promise<Etat> {
  if (!(await gerant())) return { ok: false, message: "Action réservée au gérant." };
  const id = String(f.get("demande_id") ?? "");
  const db = await createAuthClient();
  const { error } = await db.rpc("annuler_demande", { p_demande_id: id, p_motif: String(f.get("motif") ?? "") });
  if (error) return { ok: false, message: texteErreur(error) };
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/agenda");
  return { ok: true, message: "Demande annulée." };
}

// ——— Techniciens ———

const TechnicienSchema = z.object({
  nom: z.string().trim().min(2, "Indiquez le nom du technicien.").max(120),
  telephone: z.string().trim().max(30).optional().default(""),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  competences: z.string().trim().max(500).optional().default(""),
  zone: z.string().trim().max(500).optional().default(""),
});
const liste = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export async function enregistrerTechnicien(_: Etat, f: FormData): Promise<Etat> {
  const u = await gerant();
  if (!u) return { ok: false, message: "Action réservée au gérant." };
  const p = TechnicienSchema.safeParse(Object.fromEntries(f));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const db = await createAuthClient();
  const id = String(f.get("id") ?? "");
  const valeurs = { nom: p.data.nom, telephone: p.data.telephone || null, couleur: p.data.couleur, competences: liste(p.data.competences), zone: liste(p.data.zone) };
  const { error } = id
    ? await db.from("techniciens").update({ ...valeurs, disponible: f.get("disponible") === "on" }).eq("id", id)
    : await db.from("techniciens").insert({ ...valeurs, id: `TECH-${randomBytes(4).toString("hex").toUpperCase()}`, artisan_id: u.artisanId, disponible: true });
  if (error) return { ok: false, message: texteErreur(error) };
  revalidatePath("/techniciens");
  revalidatePath("/agenda");
  return { ok: true, message: id ? "Technicien mis à jour." : "Technicien ajouté." };
}

/** Crée le compte de connexion d'un technicien ; le mot de passe provisoire n'est affiché qu'une fois. */
export async function creerCompteTechnicien(_: Etat, f: FormData): Promise<Etat> {
  if (!(await gerant())) return { ok: false, message: "Action réservée au gérant." };
  const email = String(f.get("email") ?? "").trim();
  if (!z.string().email().safeParse(email).success) return { ok: false, message: "Adresse email invalide." };
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const octets = randomBytes(16);
  const brut = Array.from(octets, (o) => alphabet[o % alphabet.length]).join("");
  const motDePasse = `${brut.slice(0, 4)}-${brut.slice(4, 8)}-${brut.slice(8, 12)}-${brut.slice(12, 16)}`;
  const db = await createAuthClient();
  const { error } = await db.rpc("creer_compte_technicien", { p_technicien_id: String(f.get("technicien_id") ?? ""), p_email: email, p_mot_de_passe: motDePasse });
  if (error) return { ok: false, message: texteErreur(error) };
  revalidatePath("/techniciens");
  return { ok: true, message: `Compte créé pour ${email}. Transmettez-lui ce mot de passe provisoire : il pourra le changer dans Paramètres.`, motDePasse };
}

// ——— Paramètres de l'entreprise ———

const url = z.union([z.literal(""), z.string().trim().url("Adresse web invalide (elle doit commencer par https://).").max(500)]);
const EntrepriseSchema = z.object({
  entreprise: z.string().trim().min(2, "Indiquez le nom de l’entreprise.").max(160),
  telephone: z.string().trim().max(30).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Email invalide.")]).default(""),
  adresse: z.string().trim().max(240).default(""),
  siret: z.string().trim().max(30).default(""),
  lien_avis_google: url.default(""),
  logo_url: url.default(""),
  validite_devis_jours: z.coerce.number().int().min(1, "Validité : 1 jour minimum.").max(365, "Validité : 365 jours maximum."),
});

export async function enregistrerEntreprise(_: Etat, f: FormData): Promise<Etat> {
  const u = await gerant();
  if (!u) return { ok: false, message: "Action réservée au gérant." };
  const p = EntrepriseSchema.safeParse(Object.fromEntries(f));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const vide = (s: string) => s || null;
  const db = await createAuthClient();
  const { error } = await db
    .from("artisans")
    .update({
      entreprise: p.data.entreprise,
      telephone: vide(p.data.telephone),
      email: vide(p.data.email),
      adresse: vide(p.data.adresse),
      siret: vide(p.data.siret),
      lien_avis_google: vide(p.data.lien_avis_google),
      logo_url: vide(p.data.logo_url),
      validite_devis_jours: p.data.validite_devis_jours,
    })
    .eq("id", u.artisanId!);
  if (error) return { ok: false, message: texteErreur(error) };
  revalidatePath("/parametres");
  return { ok: true, message: "Paramètres enregistrés." };
}
