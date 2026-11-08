// Contrat d'échange avec le workflow n8n « AgentMultiUrgence ».
// Ce fichier ne contient que des types et des schémas : il peut être importé côté client.
import { z } from "zod";

export const TYPES_DEMANDE = ["prise_en_charge", "devis", "rapport_facture", "communication", "planning"] as const;
export type TypeDemande = (typeof TYPES_DEMANDE)[number];

export const TYPE_LABEL: Record<TypeDemande, string> = {
  prise_en_charge: "Prise en charge",
  devis: "Devis",
  rapport_facture: "Rapport et facture",
  communication: "Communication",
  planning: "Planning",
};

// ——— Requête envoyée par le navigateur à NOTRE route (jamais directement à n8n) ———

const texte = (max: number) => z.string().trim().max(max).optional().default("");

export const NouvelleDemandeSchema = z.object({
  message: z.string().trim().min(5, "Décrivez la demande (5 caractères minimum).").max(4000, "4 000 caractères maximum."),
  type_demande: z.enum(["auto", ...TYPES_DEMANDE]).default("auto"),
  client: z
    .object({
      nom: texte(120),
      telephone: texte(30).refine((v) => !v || /^[+0-9 ().-]{6,30}$/.test(v), "Numéro de téléphone invalide."),
      email: texte(160).refine((v) => !v || z.string().email().safeParse(v).success, "Adresse email invalide."),
      adresse: texte(240),
    })
    .optional(),
  intervention: z
    .object({
      date: texte(40),
      technicien: texte(120),
      constat: texte(2000),
      travaux: z.array(z.string().trim().max(300)).max(30).optional().default([]),
      materiel: z.array(z.string().trim().max(300)).max(30).optional().default([]),
    })
    .optional(),
});
export type NouvelleDemande = z.input<typeof NouvelleDemandeSchema>;

// ——— Réponse du webhook (validation tolérante : les agents IA peuvent varier) ———

const num = z.coerce.number().catch(0);
const strList = z.array(z.any()).catch([]).transform((a) => a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))));

export const LigneSchema = z
  .object({ designation: z.string().catch(""), quantite: num, prix_unitaire_ht: num, total_ht: num })
  .passthrough();
export type Ligne = z.infer<typeof LigneSchema>;

export const ActionsSchema = z
  .object({
    pdf: z.string().nullable().catch(null),
    email_envoye: z.boolean().catch(false),
    email_destinataire: z.string().nullable().catch(null),
    evenement_agenda: z.string().nullable().catch(null),
  })
  .partial()
  .passthrough();
export type Actions = z.infer<typeof ActionsSchema>;

export const ReponseAgentSchema = z
  .object({
    success: z.boolean(),
    id: z.string().nullable().optional(),
    reference: z.string().nullable().optional(),
    type_demande: z.string().nullable().optional(),
    resultat: z.record(z.any()).nullable().optional(),
    actions: ActionsSchema.nullable().optional(),
    donnees_fictives: z.boolean().optional(),
  })
  .passthrough();
export type ReponseAgent = z.infer<typeof ReponseAgentSchema>;

// Schémas par type de résultat — utilisés à l'affichage avec safeParse (jamais bloquants).
export const PriseEnChargeSchema = z.object({
  urgence: z.string().catch("normale"),
  resume: z.string().catch(""),
  type_probleme: z.string().catch(""),
  infos_collectees: z.record(z.any()).catch({}),
  infos_manquantes: strList,
  technicien_suggere: z.object({ id: z.string().catch(""), nom: z.string().catch(""), raison: z.string().catch("") }).partial().nullable().catch(null),
  delai_estime_minutes: z.coerce.number().nullable().catch(null),
  fourchette_prix_indicative_ht: z.object({ min: num, max: num }).nullable().catch(null),
  message_client: z.string().catch(""),
});

export const DevisSchema = z.object({
  numero_devis: z.string().catch(""),
  lignes: z.array(LigneSchema).catch([]),
  majorations_appliquees: strList,
  total_ht: num,
  tva_taux: num,
  montant_tva: num,
  total_ttc: num,
  validite_jours: z.coerce.number().nullable().catch(null),
  infos_manquantes: strList,
  avertissements: strList,
  message_client: z.string().catch(""),
});

export const RapportFactureSchema = z.object({
  rapport: z
    .object({
      date_intervention: z.string().catch(""),
      technicien: z.string().catch(""),
      adresse: z.string().catch(""),
      constat: z.string().catch(""),
      travaux_realises: strList,
      materiel_pose: strList,
      recommandations: strList,
    })
    .catch({ date_intervention: "", technicien: "", adresse: "", constat: "", travaux_realises: [], materiel_pose: [], recommandations: [] }),
  facture: z
    .object({
      numero: z.string().catch(""),
      lignes: z.array(LigneSchema).catch([]),
      total_ht: num,
      tva_taux: num,
      montant_tva: num,
      total_ttc: num,
      conditions_paiement: z.string().catch(""),
    })
    .catch({ numero: "", lignes: [], total_ht: 0, tva_taux: 0, montant_tva: 0, total_ttc: 0, conditions_paiement: "" }),
  infos_manquantes: strList,
  message_client: z.string().catch(""),
});

export const CommunicationSchema = z.object({
  type_message: z.string().catch(""),
  canal: z.string().catch("email"),
  destinataire: z
    .union([z.object({ nom: z.string().optional(), telephone: z.string().optional(), email: z.string().optional() }).passthrough(), z.string()])
    .nullable()
    .catch(null),
  objet: z.string().catch(""),
  contenu: z.string().catch(""),
  a_envoyer: z.boolean().catch(false),
  infos_manquantes: strList,
});

const CreneauSchema = z
  .object({ date: z.string().catch(""), heure_debut: z.string().catch(""), heure_fin: z.string().catch(""), technicien_id: z.string().catch(""), technicien_nom: z.string().catch("") })
  .partial();
export type Creneau = z.infer<typeof CreneauSchema>;

export const PlanningSchema = z.object({
  action: z.string().catch("proposer"),
  creneau_propose: CreneauSchema.nullable().catch(null),
  alternatives: z.array(z.union([CreneauSchema, z.string()])).catch([]),
  infos_manquantes: strList,
  avertissements: strList,
  message_client: z.string().catch(""),
});

/** Résultat invalide renvoyé par le workflow quand l'agent n'a pas produit de JSON exploitable. */
export function erreurAgent(resultat: unknown): { erreur: string; brut: string } | null {
  if (resultat && typeof resultat === "object" && "erreur" in resultat) {
    const r = resultat as { erreur?: unknown; brut?: unknown };
    return { erreur: String(r.erreur ?? "Réponse de l'agent invalide"), brut: String(r.brut ?? "") };
  }
  return null;
}

// ——— Réponse de NOTRE route au navigateur ———

export type CodeErreur =
  | "non_connecte"
  | "validation"
  | "limite"
  | "config"
  | "timeout"
  | "secret_refuse"
  | "webhook_introuvable"
  | "erreur_workflow"
  | "reponse_illisible"
  | "reseau";

export type ApiReponse =
  | { ok: true; data: ReponseAgent; dureeMs: number; simule: boolean }
  | { ok: false; code: CodeErreur; message: string; details?: Record<string, string> };
