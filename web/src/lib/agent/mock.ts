import "server-only";
import type { DemandeRow } from "./db";
import type { PayloadN8n, ResultatAppel } from "./n8n";
import type { TypeDemande } from "./types";

/**
 * Mode simulé (AGENT_MOCK=1) : réponses fictives au format exact du webhook, sans appel à n8n,
 * sans email, sans événement d'agenda et sans écriture en base.
 * Mots-clés pour tester les erreurs : #timeout, #secret, #404, #500, #json.
 */

function classer(message: string): TypeDemande {
  const m = message.toLowerCase();
  if (/(facture|rapport|termin)/.test(m)) return "rapport_facture";
  if (/(devis|prix|combien|tarif|estimation)/.test(m)) return "devis";
  if (/(rendez-vous|rdv|créneau|creneau|planifi|reporter|annuler)/.test(m)) return "planning";
  if (/(relance|avis|remerci|message au client|confirmation)/.test(m)) return "communication";
  return "prise_en_charge";
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resultatPour(type: TypeDemande, p: PayloadN8n, ref: string): Record<string, unknown> {
  const nom = p.client?.nom || "";
  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  switch (type) {
    case "prise_en_charge":
      return {
        agent: "prise_en_charge",
        urgence: /enfant|bébé|effraction|cambriol/i.test(p.message) ? "critique" : /claqu|bloqu|perdu/i.test(p.message) ? "haute" : "normale",
        resume: "Client bloqué à l'extérieur suite à une porte claquée, demande une intervention rapide.",
        type_probleme: "porte claquée",
        infos_collectees: { nom, telephone: p.client?.telephone || "", adresse: p.client?.adresse || "", probleme: "porte claquée" },
        infos_manquantes: [!p.client?.telephone && "téléphone du client", !p.client?.adresse && "adresse exacte (étage, code)"].filter(Boolean),
        technicien_suggere: { id: "TECH-DEMO-01", nom: "Karim (fictif)", raison: "Disponible, compétence ouverture de porte, zone couverte." },
        delai_estime_minutes: 35,
        fourchette_prix_indicative_ht: { min: 90, max: 150 },
        message_client: `Bonjour${nom ? " " + nom : ""}, nous avons bien reçu votre demande. Un technicien peut être chez vous d'ici 35 minutes environ. Tarif indicatif : 90 à 150 € HT, confirmé avant toute intervention.`,
      };
    case "devis":
      return {
        agent: "devis",
        numero_devis: `DEV-DEMO-${ref.slice(-6)}`,
        lignes: [
          { designation: "Déplacement zone 1", quantite: 1, prix_unitaire_ht: 35, total_ht: 35 },
          { designation: "Remplacement cylindre européen 30/30", quantite: 1, prix_unitaire_ht: 45, total_ht: 45 },
          { designation: "Main d'œuvre", quantite: 1, prix_unitaire_ht: 65, total_ht: 65 },
        ],
        majorations_appliquees: [],
        total_ht: 145,
        tva_taux: 10,
        montant_tva: 14.5,
        total_ttc: 159.5,
        validite_jours: 30,
        infos_manquantes: ["ancienneté du logement (pour confirmer la TVA à 10 %)"],
        avertissements: ["TVA à 10 % appliquée sous réserve d'un logement de plus de 2 ans."],
        message_client: "Veuillez trouver ci-joint notre devis. Il est valable 30 jours.",
      };
    case "rapport_facture": {
      const iv = p.intervention;
      return {
        agent: "rapport_facture",
        rapport: {
          date_intervention: iv?.date || new Date().toISOString().slice(0, 10),
          technicien: iv?.technicien || "Karim (fictif)",
          adresse: p.client?.adresse || "",
          constat: iv?.constat || "Cylindre forcé, porte ne fermant plus à clé.",
          travaux_realises: iv?.travaux?.length ? iv.travaux : ["Dépose du cylindre endommagé", "Pose d'un cylindre neuf", "Essais de fonctionnement"],
          materiel_pose: iv?.materiel?.length ? iv.materiel : ["Cylindre européen 30/30"],
          recommandations: ["Prévoir une serrure 3 points pour renforcer la sécurité."],
          utilisable_assurance: true,
        },
        facture: {
          numero: `FAC-DEMO-${ref.slice(-6)}`,
          lignes: [
            { designation: "Déplacement", quantite: 1, prix_unitaire_ht: 35, total_ht: 35 },
            { designation: "Cylindre européen 30/30", quantite: 1, prix_unitaire_ht: 45, total_ht: 45 },
            { designation: "Main d'œuvre", quantite: 1, prix_unitaire_ht: 65, total_ht: 65 },
          ],
          total_ht: 145,
          tva_taux: 10,
          montant_tva: 14.5,
          total_ttc: 159.5,
          conditions_paiement: "Paiement à réception",
        },
        infos_manquantes: [],
        message_client: "Veuillez trouver ci-joint le rapport d'intervention et la facture correspondante.",
      };
    }
    case "communication":
      return {
        agent: "communication",
        type_message: "relance_devis",
        canal: "email",
        destinataire: { nom, telephone: p.client?.telephone || "", email: p.client?.email || "" },
        objet: "Votre devis est toujours disponible",
        contenu: `Bonjour${nom ? " " + nom : ""},\n\nNous revenons vers vous au sujet du devis envoyé récemment. Il reste valable 30 jours ; n'hésitez pas à nous contacter pour toute question.\n\nBien cordialement,\nL'équipe (démo)`,
        a_envoyer: !!p.client?.email,
        infos_manquantes: p.client?.email ? [] : ["email du client"],
      };
    case "planning":
      return {
        agent: "planning",
        action: "proposer",
        creneau_propose: { date: demain, heure_debut: "10:00", heure_fin: "11:30", technicien_id: "TECH-DEMO-02", technicien_nom: "Julien (fictif)" },
        alternatives: [
          { date: demain, heure_debut: "14:00", heure_fin: "15:30", technicien_id: "TECH-DEMO-01", technicien_nom: "Karim (fictif)" },
          { date: demain, heure_debut: "16:30", heure_fin: "18:00", technicien_id: "TECH-DEMO-02", technicien_nom: "Julien (fictif)" },
        ],
        infos_manquantes: [],
        avertissements: [],
        message_client: `Nous vous proposons une intervention le ${demain} entre 10h00 et 11h30.`,
      };
  }
}

export async function appelerAgentSimule(p: PayloadN8n): Promise<ResultatAppel> {
  const debut = Date.now();
  const delai = Number(process.env.AGENT_MOCK_DELAY_MS ?? 2500);
  await attendre(delai);
  const dureeMs = Date.now() - debut;
  if (p.message.includes("#timeout")) return { ok: false, code: "timeout", message: "L'agent n'a pas répondu en 60 secondes (simulation).", dureeMs };
  if (p.message.includes("#secret")) return { ok: false, code: "secret_refuse", httpStatus: 403, message: "n8n a refusé le secret : vérifiez N8N_WEBHOOK_SECRET (simulation).", dureeMs };
  if (p.message.includes("#404")) return { ok: false, code: "webhook_introuvable", httpStatus: 404, message: "Webhook introuvable : workflow désactivé ou URL incorrecte (simulation).", dureeMs };
  if (p.message.includes("#500")) return { ok: false, code: "erreur_workflow", httpStatus: 500, message: "Le workflow a échoué (HTTP 500) (simulation).", dureeMs };

  const type = p.type_demande ?? classer(p.message);
  const reference = `DEM-${Date.now()}`;
  const invalide = p.message.includes("#json");
  const resultat = invalide ? { erreur: "Réponse de l'agent non conforme au format JSON", brut: "Voici le devis demandé : total 145 € HT (texte libre au lieu du JSON attendu)" } : resultatPour(type, p, reference);
  const docs = !invalide && (type === "devis" || type === "rapport_facture");
  const emailComm = !invalide && type === "communication" && (resultat as { a_envoyer?: boolean }).a_envoyer;
  return {
    ok: true,
    dureeMs,
    data: {
      success: !invalide,
      id: crypto.randomUUID(),
      reference,
      type_demande: type,
      resultat,
      actions: {
        pdf: docs ? `${type === "devis" ? "DEV" : "FAC"}-DEMO-${reference.slice(-6)}.pdf` : null,
        email_envoye: docs || !!emailComm,
        email_destinataire: docs || emailComm ? "adresse-de-test@example.com" : null,
        evenement_agenda: !invalide && type === "planning" ? "https://calendar.google.com/calendar/u/0/r" : null,
      },
      donnees_fictives: true,
    },
  };
}

/** Quelques demandes fictives pour tester l'historique sans base configurée. */
export function demandesSimulees(artisanId: string): DemandeRow[] {
  const types: TypeDemande[] = ["prise_en_charge", "devis", "planning", "communication", "rapport_facture", "devis"];
  const p: PayloadN8n = { message: "", artisan_id: artisanId, client: { nom: "Claire Martin (fictive)", telephone: "06 39 98 12 34", email: "", adresse: "12 rue Victor Hugo, 69002 Lyon" } };
  return types.map((t, i) => {
    const ref = `DEM-17930000000${i}`;
    const erreur = i === 5;
    return {
      id: `00000000-0000-4000-8000-00000000000${i}`,
      reference: ref,
      artisan_id: artisanId,
      client_id: null,
      client_nom: p.client!.nom,
      client_telephone: p.client!.telephone,
      client_email: null,
      message: ["Porte claquée, clés à l'intérieur, enfant seul dedans", "Combien pour changer un cylindre ?", "Fixer un rendez-vous demain matin", "Relancer le devis DEV-0042", "Intervention terminée : cylindre remplacé", "Devis pour serrure 3 points"][i],
      type_demande: t,
      routage: { confiance: 0.92, raison: "Demande classée automatiquement (simulation)." },
      resultat: erreur ? { erreur: "Réponse de l'agent non conforme au format JSON", brut: "texte libre" } : resultatPour(t, { ...p, message: "enfant porte claquée" }, ref),
      actions: { pdf: null, email_envoye: false, email_destinataire: null, evenement_agenda: null },
      statut: erreur ? "erreur" : "traite",
      donnees_fictives: true,
      created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
    };
  });
}
