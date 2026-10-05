// Types métier du prototype — reflètent le modèle de données de docs/ARCHITECTURE.md (sous-ensemble).

export type Trade = 'serrurerie' | 'plomberie' | 'chauffage'
export type Role = 'admin' | 'dispatcher' | 'technician'

export interface LatLng {
  lat: number
  lng: number
}

export interface Company {
  id: string
  name: string
  legalName: string
  shortName: string
  trades: Trade[]
  city: string
  center: LatLng
  phone: string
  email: string
  siret: string
  vatNumber: string
  address: string
  insurance: string
  hourlyRateCents: number
  brandColor: string
  googleRating: number
  googleReviewCount: number
  postalCodes: string[]
}

export interface Technician {
  id: string
  companyId: string
  firstName: string
  lastName: string
  phone: string
  color: string
  skills: string[]
  vehicle: string
  onCall: boolean
  active: boolean
  /** Position simulée (partage de position pendant le service) */
  position: LatLng
  shareLocation: boolean
}

export type ClientType = 'particulier' | 'professionnel' | 'syndic' | 'agence_immobiliere' | 'assureur'

export interface Address {
  id: string
  line1: string
  postalCode: string
  city: string
  location: LatLng
  housingType: 'appartement' | 'maison' | 'local_pro' | 'parties_communes'
  floor?: string
  doorCode?: string
  intercom?: string
  accessNotes?: string
}

export interface Client {
  id: string
  companyId: string
  type: ClientType
  firstName: string
  lastName: string
  companyName?: string
  phone: string
  email?: string
  tags: string[]
  notes?: string
  addresses: Address[]
  createdAt: number
  smsOptOut: boolean
}

export type Urgency = 'absolue' | 'moins_2h' | 'dans_la_journee' | 'planifiee'

export type RequestStatus =
  | 'nouvelle'
  | 'qualifiee'
  | 'devis_envoye'
  | 'acceptee'
  | 'planifiee'
  | 'en_route'
  | 'sur_place'
  | 'terminee'
  | 'facturee'
  | 'payee'
  | 'cloturee'
  | 'annulee'
  | 'perdue'

export type RequestSource = 'appel' | 'appel_manque' | 'sms' | 'web' | 'api' | 'manuel'

export interface PriceLine {
  label: string
  detail?: string
  minCents: number
  maxCents: number
  kind: 'service' | 'labor' | 'part' | 'travel' | 'surcharge'
}

export interface PriceEstimate {
  minCents: number
  maxCents: number
  lines: PriceLine[]
  surcharges: string[]
  zone: string
  outOfZone: boolean
}

/** Proposition d'un agent IA (n8n) — jamais appliquée sans validation, sauf automatisation activée. */
export interface AiProposal {
  summary: string
  problemTypeCode: string
  urgency: Urgency
  complexity: number
  durationMin: number
  priceMinCents: number
  priceMaxCents: number
  confidence: number
  agent: string
  processedAt: number
  reviewStatus: 'proposed' | 'accepted' | 'edited' | 'rejected'
  suggestedTechnicianId?: string
}

export interface StatusChange {
  status: RequestStatus
  at: number
  actor: string
  reason?: string
}

export interface Media {
  id: string
  requestId: string
  kind: 'photo' | 'video'
  category: 'client' | 'avant' | 'apres'
  caption: string
  /** Illustration générée (aucune vraie photo dans la démo) ou URL blob pour un fichier ajouté. */
  art?: string
  src?: string
  at: number
}

export interface ServiceRequest {
  id: string
  companyId: string
  ref: string
  clientId: string
  addressId: string
  source: RequestSource
  trade: Trade
  problemTypeCode: string
  urgency: Urgency
  description: string
  complexity: number
  durationMin: number
  estimate: PriceEstimate
  status: RequestStatus
  history: StatusChange[]
  createdAt: number
  lostReason?: string
  ai?: AiProposal
  media: Media[]
  locationShared?: { at: number; method: 'gps' | 'adresse' }
  photoLinkSentAt?: number
  callId?: string
  quoteId?: string
  jobId?: string
  invoiceId?: string
  reviewId?: string
  notes: { at: number; author: string; text: string }[]
}

export type CallStatus = 'repondu' | 'manque' | 'messagerie' | 'agent_ia'

export interface Call {
  id: string
  companyId: string
  from: string
  clientId?: string
  requestId?: string
  status: CallStatus
  at: number
  durationSec: number
  waitSec: number
  answeredBy?: string
  recording: boolean
  transcript?: string
  aiSummary?: string
  missedSmsSent?: boolean
}

export type QuoteStatus = 'brouillon' | 'envoye' | 'consulte' | 'signe' | 'refuse' | 'expire'

export interface DocLine {
  id: string
  label: string
  detail?: string
  quantity: number
  unit: string
  unitPriceCents: number
  vatRate: number // 20, 10, 5.5
  kind: 'service' | 'labor' | 'part' | 'travel' | 'surcharge'
}

export interface Quote {
  id: string
  companyId: string
  ref: string
  requestId: string
  clientId: string
  status: QuoteStatus
  lines: DocLine[]
  createdAt: number
  sentAt?: number
  viewedAt?: number
  signedAt?: number
  signerName?: string
  signature?: string
  validUntil: number
  depositPercent: number
  urgentWaiver: boolean
  aiDraft?: boolean
  reminders: number[]
}

export type JobStatus = 'a_planifier' | 'proposee' | 'acceptee' | 'en_route' | 'sur_place' | 'terminee' | 'annulee'

export interface JobReport {
  workDone: string
  observations: string
  parts: { label: string; quantity: number }[]
  durationMin: number
  photos: Media[]
  signature?: string
  signerName?: string
}

export interface Job {
  id: string
  companyId: string
  requestId: string
  technicianId?: string
  status: JobStatus
  start: number
  durationMin: number
  etaMin?: number
  enRouteAt?: number
  arrivedAt?: number
  completedAt?: number
  report?: JobReport
}

export type InvoiceStatus = 'brouillon' | 'emise' | 'payee' | 'en_retard' | 'partielle'
export type PaymentMethod = 'cb_en_ligne' | 'cb_terminal' | 'especes' | 'cheque' | 'virement'

export interface Payment {
  id: string
  amountCents: number
  method: PaymentMethod
  at: number
}

export interface Invoice {
  id: string
  companyId: string
  ref: string
  requestId: string
  clientId: string
  technicianId?: string
  kind: 'facture' | 'avoir'
  status: InvoiceStatus
  lines: DocLine[]
  issuedAt: number
  dueAt: number
  payments: Payment[]
}

export interface Sms {
  id: string
  companyId: string
  clientId: string
  requestId?: string
  direction: 'sortant' | 'entrant'
  body: string
  at: number
  status: 'envoye' | 'distribue' | 'echec' | 'recu'
  template?: string
  by: 'automatisation' | 'utilisateur' | 'agent_ia' | 'client'
}

export interface Review {
  id: string
  companyId: string
  requestId?: string
  clientId?: string
  technicianId?: string
  source: 'interne' | 'google'
  rating: number
  comment: string
  author: string
  at: number
  reply?: string
}

export interface AppEvent {
  id: string
  companyId: string
  type: string
  at: number
  summary: string
  entityId?: string
  actor: string
}

export interface WebhookEndpoint {
  id: string
  companyId: string
  url: string
  description: string
  events: string[]
  active: boolean
  secretPreview: string
}

export interface WebhookDelivery {
  id: string
  endpointId: string
  eventId: string
  eventType: string
  at: number
  status: 'succes' | 'echec' | 'en_attente'
  httpStatus?: number
  durationMs?: number
  attempt: number
}

export interface ApiKey {
  id: string
  companyId: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt?: number
  createdAt: number
}

export interface SmsTemplate {
  key: string
  name: string
  body: string
  active: boolean
  trigger: string
}

export interface Automation {
  key: string
  label: string
  description: string
  enabled: boolean
  detail?: string
  ai?: boolean
}
