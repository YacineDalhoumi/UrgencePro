// Données de référence : catalogues par métier, types de problèmes, majorations, libellés de statuts.
import type { ClientType, JobStatus, QuoteStatus, InvoiceStatus, RequestStatus, Trade, Urgency, CallStatus, RequestSource, PaymentMethod } from './types'

export interface CatalogItem {
  code: string
  label: string
  unit: string
  priceHtCents: number
  kind: 'service' | 'labor' | 'part' | 'travel'
  trade: Trade | 'commun'
  stock?: boolean
}

export interface ProblemType {
  code: string
  trade: Trade
  label: string
  complexity: number
  durationMin: number
  /** Éléments certains (fourchette basse) */
  items: { code: string; qty: number }[]
  /** Éléments possibles selon le diagnostic (fourchette haute) */
  optional: { code: string; qty: number }[]
  skill: string
}

export const CATALOG: CatalogItem[] = [
  // Commun
  { code: 'DEP-Z1', label: 'Déplacement zone 1', unit: 'forfait', priceHtCents: 3500, kind: 'travel', trade: 'commun' },
  { code: 'DEP-Z2', label: 'Déplacement zone 2', unit: 'forfait', priceHtCents: 4900, kind: 'travel', trade: 'commun' },
  { code: 'MO-H', label: "Main d'œuvre", unit: 'h', priceHtCents: 6500, kind: 'labor', trade: 'commun' },
  // Serrurerie
  { code: 'OUV-CLAQ', label: 'Ouverture de porte claquée', unit: 'forfait', priceHtCents: 7900, kind: 'service', trade: 'serrurerie' },
  { code: 'OUV-FERM', label: 'Ouverture de porte fermée à clé', unit: 'forfait', priceHtCents: 11900, kind: 'service', trade: 'serrurerie' },
  { code: 'EXTR-CLE', label: 'Extraction de clé cassée', unit: 'forfait', priceHtCents: 5900, kind: 'service', trade: 'serrurerie' },
  { code: 'CYL-STD', label: 'Cylindre européen 30/30', unit: 'u', priceHtCents: 4500, kind: 'part', trade: 'serrurerie', stock: true },
  { code: 'CYL-A2P', label: 'Cylindre haute sécurité A2P*', unit: 'u', priceHtCents: 12900, kind: 'part', trade: 'serrurerie', stock: true },
  { code: 'SER-3P', label: 'Serrure 3 points en applique', unit: 'u', priceHtCents: 18900, kind: 'part', trade: 'serrurerie', stock: true },
  { code: 'SER-LARD', label: 'Serrure à larder', unit: 'u', priceHtCents: 7900, kind: 'part', trade: 'serrurerie', stock: true },
  { code: 'MES-PROV', label: 'Mise en sécurité provisoire', unit: 'forfait', priceHtCents: 14900, kind: 'service', trade: 'serrurerie' },
  { code: 'POSE-SER', label: 'Pose de serrure', unit: 'forfait', priceHtCents: 6900, kind: 'service', trade: 'serrurerie' },
  // Plomberie
  { code: 'REC-FUITE', label: 'Recherche de fuite non destructive', unit: 'forfait', priceHtCents: 18000, kind: 'service', trade: 'plomberie' },
  { code: 'JOINT', label: 'Remplacement joint / raccord', unit: 'u', priceHtCents: 2500, kind: 'part', trade: 'plomberie', stock: true },
  { code: 'MITIGEUR', label: 'Mitigeur évier', unit: 'u', priceHtCents: 8900, kind: 'part', trade: 'plomberie', stock: true },
  { code: 'DEB-WC', label: 'Débouchage WC (furet)', unit: 'forfait', priceHtCents: 8900, kind: 'service', trade: 'plomberie' },
  { code: 'DEB-HP', label: 'Débouchage haute pression', unit: 'forfait', priceHtCents: 21900, kind: 'service', trade: 'plomberie' },
  { code: 'GRP-SEC', label: 'Groupe de sécurité chauffe-eau', unit: 'u', priceHtCents: 6500, kind: 'part', trade: 'plomberie', stock: true },
  { code: 'RES-CE', label: 'Résistance chauffe-eau', unit: 'u', priceHtCents: 7900, kind: 'part', trade: 'plomberie', stock: true },
  { code: 'DIAG-CHAUD', label: 'Diagnostic chaudière gaz', unit: 'forfait', priceHtCents: 9500, kind: 'service', trade: 'chauffage' },
  { code: 'ENT-CHAUD', label: 'Entretien annuel chaudière gaz', unit: 'forfait', priceHtCents: 12900, kind: 'service', trade: 'chauffage' },
  { code: 'PIECE-CHAUD', label: 'Pièce chaudière (sonde, électrode…)', unit: 'u', priceHtCents: 11500, kind: 'part', trade: 'chauffage', stock: true },
]

export const catalogByCode = Object.fromEntries(CATALOG.map((c) => [c.code, c])) as Record<string, CatalogItem>

export const PROBLEM_TYPES: ProblemType[] = [
  { code: 'porte_claquee', trade: 'serrurerie', label: 'Porte claquée', complexity: 1, durationMin: 30, items: [{ code: 'OUV-CLAQ', qty: 1 }], optional: [], skill: 'Ouverture de porte' },
  { code: 'porte_fermee', trade: 'serrurerie', label: 'Porte fermée à clé', complexity: 2, durationMin: 45, items: [{ code: 'OUV-FERM', qty: 1 }], optional: [{ code: 'CYL-STD', qty: 1 }], skill: 'Ouverture de porte' },
  { code: 'cle_cassee', trade: 'serrurerie', label: 'Clé cassée dans la serrure', complexity: 2, durationMin: 40, items: [{ code: 'EXTR-CLE', qty: 1 }], optional: [{ code: 'CYL-STD', qty: 1 }], skill: 'Ouverture de porte' },
  { code: 'serrure_cassee', trade: 'serrurerie', label: 'Serrure cassée ou bloquée', complexity: 3, durationMin: 60, items: [{ code: 'POSE-SER', qty: 1 }, { code: 'SER-LARD', qty: 1 }], optional: [{ code: 'SER-3P', qty: 1 }], skill: 'Remplacement de serrure' },
  { code: 'effraction', trade: 'serrurerie', label: 'Effraction / mise en sécurité', complexity: 4, durationMin: 120, items: [{ code: 'MES-PROV', qty: 1 }, { code: 'CYL-STD', qty: 1 }], optional: [{ code: 'SER-3P', qty: 1 }, { code: 'MO-H', qty: 1 }], skill: 'Effraction' },
  { code: 'changement_cylindre', trade: 'serrurerie', label: 'Changement de cylindre', complexity: 1, durationMin: 30, items: [{ code: 'CYL-STD', qty: 1 }, { code: 'MO-H', qty: 0.5 }], optional: [{ code: 'CYL-A2P', qty: 1 }], skill: 'Remplacement de serrure' },
  { code: 'blindage', trade: 'serrurerie', label: 'Porte blindée bloquée', complexity: 5, durationMin: 150, items: [{ code: 'OUV-FERM', qty: 1 }, { code: 'MO-H', qty: 1 }], optional: [{ code: 'CYL-A2P', qty: 1 }, { code: 'MO-H', qty: 1 }], skill: 'Porte blindée' },

  { code: 'fuite_eau', trade: 'plomberie', label: "Fuite d'eau apparente", complexity: 2, durationMin: 60, items: [{ code: 'MO-H', qty: 1 }, { code: 'JOINT', qty: 2 }], optional: [{ code: 'MITIGEUR', qty: 1 }], skill: 'Fuite' },
  { code: 'wc_bouche', trade: 'plomberie', label: 'WC bouché', complexity: 2, durationMin: 45, items: [{ code: 'DEB-WC', qty: 1 }], optional: [{ code: 'DEB-HP', qty: 1 }], skill: 'Débouchage' },
  { code: 'canalisation', trade: 'plomberie', label: 'Canalisation bouchée', complexity: 3, durationMin: 90, items: [{ code: 'DEB-HP', qty: 1 }], optional: [{ code: 'MO-H', qty: 1 }], skill: 'Débouchage' },
  { code: 'chauffe_eau', trade: 'plomberie', label: 'Chauffe-eau en panne', complexity: 3, durationMin: 90, items: [{ code: 'MO-H', qty: 1 }, { code: 'RES-CE', qty: 1 }], optional: [{ code: 'GRP-SEC', qty: 1 }], skill: 'Chauffe-eau' },
  { code: 'degat_eaux', trade: 'plomberie', label: 'Dégât des eaux / recherche de fuite', complexity: 4, durationMin: 150, items: [{ code: 'REC-FUITE', qty: 1 }], optional: [{ code: 'MO-H', qty: 1.5 }, { code: 'JOINT', qty: 3 }], skill: 'Fuite' },
  { code: 'chaudiere_panne', trade: 'chauffage', label: 'Chaudière en panne', complexity: 4, durationMin: 120, items: [{ code: 'DIAG-CHAUD', qty: 1 }], optional: [{ code: 'PIECE-CHAUD', qty: 1 }, { code: 'MO-H', qty: 1 }], skill: 'Chaudière gaz' },
  { code: 'entretien_chaudiere', trade: 'chauffage', label: 'Entretien annuel chaudière', complexity: 1, durationMin: 60, items: [{ code: 'ENT-CHAUD', qty: 1 }], optional: [], skill: 'Chaudière gaz' },
]

export const problemByCode = Object.fromEntries(PROBLEM_TYPES.map((p) => [p.code, p])) as Record<string, ProblemType>

export interface SurchargeRule {
  key: 'nuit' | 'samedi' | 'dimanche_ferie' | 'urgence'
  label: string
  window: string
  percent: number
  appliesTo: string
}

export const SURCHARGES: SurchargeRule[] = [
  { key: 'nuit', label: 'Nuit', window: '20 h – 8 h', percent: 50, appliesTo: "Forfaits et main d'œuvre" },
  { key: 'samedi', label: 'Samedi après-midi', window: 'Samedi 12 h – 20 h', percent: 25, appliesTo: "Forfaits et main d'œuvre" },
  { key: 'dimanche_ferie', label: 'Dimanche et jours fériés', window: 'Toute la journée', percent: 50, appliesTo: "Forfaits et main d'œuvre" },
  { key: 'urgence', label: 'Urgence absolue', window: 'Intervention en moins d’1 h', percent: 20, appliesTo: 'Forfaits uniquement' },
]

/** Jours fériés métropole 2026–2027 (AAAA-MM-JJ). */
export const HOLIDAYS = new Set([
  '2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25', '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25',
  '2027-01-01', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-08', '2027-05-17', '2027-07-14', '2027-08-15', '2027-11-01', '2027-11-11', '2027-12-25',
])

export const TRADE_LABEL: Record<Trade, string> = { serrurerie: 'Serrurerie', plomberie: 'Plomberie', chauffage: 'Chauffage' }

export const URGENCY: Record<Urgency, { label: string; short: string; tone: Tone }> = {
  absolue: { label: 'Urgence absolue (< 1 h)', short: 'Absolue', tone: 'bad' },
  moins_2h: { label: 'Rapide (< 2 h)', short: '< 2 h', tone: 'warn' },
  dans_la_journee: { label: 'Dans la journée', short: 'Journée', tone: 'info' },
  planifiee: { label: 'Planifiée', short: 'Planifiée', tone: 'neutral' },
}

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'info' | 'ai'

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  nouvelle: { label: 'Nouvelle', tone: 'accent' },
  qualifiee: { label: 'Qualifiée', tone: 'info' },
  devis_envoye: { label: 'Devis envoyé', tone: 'warn' },
  acceptee: { label: 'Acceptée', tone: 'ok' },
  planifiee: { label: 'Planifiée', tone: 'info' },
  en_route: { label: 'Technicien en route', tone: 'accent' },
  sur_place: { label: 'Sur place', tone: 'accent' },
  terminee: { label: 'Terminée', tone: 'ok' },
  facturee: { label: 'Facturée', tone: 'warn' },
  payee: { label: 'Payée', tone: 'ok' },
  cloturee: { label: 'Clôturée', tone: 'neutral' },
  annulee: { label: 'Annulée', tone: 'neutral' },
  perdue: { label: 'Perdue', tone: 'bad' },
}

/** Ordre du cycle de vie (colonnes du kanban). */
export const PIPELINE: RequestStatus[] = ['nouvelle', 'qualifiee', 'devis_envoye', 'acceptee', 'planifiee', 'en_route', 'sur_place', 'terminee', 'facturee', 'payee']

/** Transitions autorisées (machine à états, cf. architecture §4.5). */
export const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  nouvelle: ['qualifiee', 'annulee', 'perdue'],
  qualifiee: ['devis_envoye', 'planifiee', 'perdue', 'annulee'],
  devis_envoye: ['acceptee', 'perdue'],
  acceptee: ['planifiee', 'annulee'],
  planifiee: ['en_route', 'annulee'],
  en_route: ['sur_place'],
  sur_place: ['terminee'],
  terminee: ['facturee'],
  facturee: ['payee'],
  payee: ['cloturee'],
  cloturee: [],
  annulee: [],
  perdue: [],
}

export const LOST_REASONS = ['Prix jugé trop élevé', 'A trouvé un autre artisan', 'Client injoignable', 'Hors zone', 'Problème résolu seul', 'Délai trop long']

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: Tone }> = {
  brouillon: { label: 'Brouillon', tone: 'neutral' },
  envoye: { label: 'Envoyé', tone: 'warn' },
  consulte: { label: 'Consulté', tone: 'info' },
  signe: { label: 'Signé', tone: 'ok' },
  refuse: { label: 'Refusé', tone: 'bad' },
  expire: { label: 'Expiré', tone: 'neutral' },
}

export const JOB_STATUS: Record<JobStatus, { label: string; tone: Tone }> = {
  a_planifier: { label: 'À planifier', tone: 'warn' },
  proposee: { label: 'En attente du technicien', tone: 'warn' },
  acceptee: { label: 'Acceptée', tone: 'info' },
  en_route: { label: 'En route', tone: 'accent' },
  sur_place: { label: 'Sur place', tone: 'accent' },
  terminee: { label: 'Terminée', tone: 'ok' },
  annulee: { label: 'Annulée', tone: 'neutral' },
}

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  brouillon: { label: 'Brouillon', tone: 'neutral' },
  emise: { label: 'Émise', tone: 'info' },
  partielle: { label: 'Paiement partiel', tone: 'warn' },
  payee: { label: 'Payée', tone: 'ok' },
  en_retard: { label: 'En retard', tone: 'bad' },
}

export const CALL_STATUS: Record<CallStatus, { label: string; tone: Tone }> = {
  repondu: { label: 'Répondu', tone: 'ok' },
  manque: { label: 'Manqué', tone: 'bad' },
  messagerie: { label: 'Messagerie', tone: 'warn' },
  agent_ia: { label: 'Agent vocal IA', tone: 'ai' },
}

export const SOURCE_LABEL: Record<RequestSource, string> = {
  appel: 'Appel',
  appel_manque: 'Appel manqué',
  sms: 'SMS',
  web: 'Formulaire web',
  api: 'API (n8n)',
  manuel: 'Saisie manuelle',
}

export const CLIENT_TYPE: Record<ClientType, string> = {
  particulier: 'Particulier',
  professionnel: 'Professionnel',
  syndic: 'Syndic',
  agence_immobiliere: 'Agence immobilière',
  assureur: 'Assureur',
}

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  cb_en_ligne: 'CB en ligne (Stripe)',
  cb_terminal: 'CB terminal',
  especes: 'Espèces',
  cheque: 'Chèque',
  virement: 'Virement',
}

export const HOUSING_LABEL = {
  appartement: 'Appartement',
  maison: 'Maison',
  local_pro: 'Local professionnel',
  parties_communes: 'Parties communes',
} as const

export const WEBHOOK_EVENTS = [
  'call.received', 'call.missed', 'call.ended', 'request.created', 'request.qualified', 'request.status_changed',
  'media.uploaded', 'location.received', 'quote.created', 'quote.sent', 'quote.viewed', 'quote.signed', 'quote.expired',
  'job.scheduled', 'job.assigned', 'technician.en_route', 'technician.arrived', 'job.completed',
  'invoice.created', 'invoice.paid', 'invoice.overdue', 'sms.received', 'review.received',
]

export const API_SCOPES = [
  'requests:read', 'requests:write', 'clients:read', 'clients:write', 'calls:read', 'calls:write', 'quotes:read', 'quotes:write',
  'jobs:read', 'jobs:write', 'invoices:read', 'technicians:read', 'sms:send', 'media:read', 'stats:read', 'ai:write',
]
