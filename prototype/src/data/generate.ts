// Générateur de données de démonstration — déterministe (graine fixe), relatif à « maintenant ».
// Deux entreprises fictives, 6 mois d'historique + une journée en cours scénarisée.
// Les numéros de téléphone utilisent les plages réservées par l'ARCEP à la fiction (01 99 00…, 06 39 98…).
import { problemByCode, PROBLEM_TYPES, LOST_REASONS } from './reference'
import { estimatePrice, quoteLinesFor, totals } from './pricing'
import type {
  Address, AiProposal, ApiKey, AppEvent, Automation, Call, Client, ClientType, Company, Invoice, Job, Media, PaymentMethod, Quote,
  RequestSource, RequestStatus, Review, ServiceRequest, Sms, SmsTemplate, Technician, Urgency, WebhookDelivery, WebhookEndpoint, Trade,
} from './types'
import { DAY, HOUR, MINUTE } from '@/lib/utils'

export interface StockLine {
  technicianId: string
  code: string
  qty: number
  min: number
}

export interface Dataset {
  company: Company
  technicians: Technician[]
  clients: Client[]
  requests: ServiceRequest[]
  calls: Call[]
  quotes: Quote[]
  jobs: Job[]
  invoices: Invoice[]
  sms: Sms[]
  reviews: Review[]
  events: AppEvent[]
  webhooks: WebhookEndpoint[]
  deliveries: WebhookDelivery[]
  apiKeys: ApiKey[]
  templates: SmsTemplate[]
  automations: Automation[]
  stock: StockLine[]
  counters: { request: number; quote: number; invoice: number }
}

// ——— Aléatoire déterministe ———
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

class Rng {
  next: () => number
  constructor(seed: number) {
    this.next = mulberry32(seed)
  }
  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
  real(min: number, max: number) {
    return this.next() * (max - min) + min
  }
  chance(p: number) {
    return this.next() < p
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((a, [, w]) => a + w, 0)
    let r = this.next() * total
    for (const [v, w] of items) {
      if ((r -= w) <= 0) return v
    }
    return items[items.length - 1][0]
  }
  poisson(lambda: number) {
    const L = Math.exp(-lambda)
    let k = 0
    let p = 1
    do {
      k++
      p *= this.next()
    } while (p > L)
    return k - 1
  }
}

// ——— Référentiels géographiques ———
type Area = { cp: string; city: string; lat: number; lng: number; streets: string[] }

const LYON: Area[] = [
  { cp: '69001', city: 'Lyon', lat: 45.7676, lng: 4.832, streets: ['rue de la Martinière', 'montée de la Grande Côte', 'rue Royale', "rue d'Algérie"] },
  { cp: '69002', city: 'Lyon', lat: 45.752, lng: 4.827, streets: ['rue Victor Hugo', 'rue Mercière', 'rue de Brest', 'rue Auguste Comte'] },
  { cp: '69003', city: 'Lyon', lat: 45.76, lng: 4.853, streets: ['cours Lafayette', 'rue Paul Bert', 'rue Moncey', 'avenue Félix Faure'] },
  { cp: '69004', city: 'Lyon', lat: 45.778, lng: 4.827, streets: ['boulevard de la Croix-Rousse', "rue d'Austerlitz", 'rue Dumenge', 'rue Belfort'] },
  { cp: '69005', city: 'Lyon', lat: 45.758, lng: 4.815, streets: ['rue Saint-Jean', 'montée du Chemin Neuf', 'avenue du Point du Jour'] },
  { cp: '69006', city: 'Lyon', lat: 45.77, lng: 4.852, streets: ['cours Vitton', 'rue Vendôme', 'boulevard des Belges', 'rue Duguesclin'] },
  { cp: '69007', city: 'Lyon', lat: 45.745, lng: 4.842, streets: ['avenue Jean Jaurès', 'rue de Marseille', 'rue de Gerland', 'grande rue de la Guillotière'] },
  { cp: '69008', city: 'Lyon', lat: 45.737, lng: 4.87, streets: ['avenue des Frères Lumière', 'rue Laënnec', 'avenue Paul Santy'] },
  { cp: '69009', city: 'Lyon', lat: 45.774, lng: 4.805, streets: ['rue de Bourgogne', 'quai Paul Sédallian', 'rue Marietton'] },
  { cp: '69100', city: 'Villeurbanne', lat: 45.771, lng: 4.88, streets: ['cours Émile Zola', 'rue Francis de Pressensé', 'avenue Henri Barbusse'] },
  { cp: '69300', city: 'Caluire-et-Cuire', lat: 45.796, lng: 4.846, streets: ['grande rue de Saint-Clair', 'avenue Pierre Terrasse'] },
  { cp: '69500', city: 'Bron', lat: 45.738, lng: 4.913, streets: ['avenue Franklin Roosevelt', 'rue Guillaume Paradin'] },
  { cp: '69200', city: 'Vénissieux', lat: 45.697, lng: 4.886, streets: ['avenue Jean Cagne', 'boulevard Ambroise Croizat'] },
  { cp: '69130', city: 'Écully', lat: 45.775, lng: 4.778, streets: ['chemin de la Sauvegarde', 'avenue Guy de Collongue'] },
]

const BORDEAUX: Area[] = [
  { cp: '33000', city: 'Bordeaux', lat: 44.8378, lng: -0.5792, streets: ["cours de l'Intendance", 'rue Sainte-Catherine', 'rue Notre-Dame', 'cours Victor Hugo'] },
  { cp: '33800', city: 'Bordeaux', lat: 44.824, lng: -0.564, streets: ['cours de la Marne', 'rue des Faures', 'rue Leyteire'] },
  { cp: '33300', city: 'Bordeaux', lat: 44.862, lng: -0.568, streets: ['cours Balguerie Stuttenberg', 'rue Achard', 'cours du Médoc'] },
  { cp: '33200', city: 'Bordeaux', lat: 44.85, lng: -0.61, streets: ['avenue Louis Barthou', "rue de l'Église Saint-Amand", 'avenue de la République'] },
  { cp: '33100', city: 'Bordeaux', lat: 44.841, lng: -0.552, streets: ['avenue Thiers', 'quai des Queyries', 'rue de Nuits'] },
  { cp: '33400', city: 'Talence', lat: 44.808, lng: -0.588, streets: ['cours de la Libération', 'avenue Roul'] },
  { cp: '33700', city: 'Mérignac', lat: 44.843, lng: -0.646, streets: ['avenue de la Marne', 'avenue de Verdun'] },
  { cp: '33110', city: 'Le Bouscat', lat: 44.865, lng: -0.6, streets: ['avenue de la Libération', 'avenue Victor Hugo'] },
  { cp: '33600', city: 'Pessac', lat: 44.806, lng: -0.631, streets: ['avenue Pasteur', 'avenue Jean Jaurès'] },
  { cp: '33150', city: 'Cenon', lat: 44.857, lng: -0.531, streets: ['avenue Jean Jaurès', 'rue Camille Pelletan'] },
]

const FIRST_F = ['Camille', 'Léa', 'Chloé', 'Manon', 'Inès', 'Sarah', 'Julie', 'Emma', 'Nathalie', 'Isabelle', 'Sophie', 'Claire', 'Amina', 'Lucie', 'Hélène', 'Valérie', 'Marine', 'Aurélie', 'Fatima', 'Céline', 'Pauline', 'Élodie', 'Anne', 'Martine']
const FIRST_M = ['Thomas', 'Nicolas', 'Julien', 'Maxime', 'Alexandre', 'Antoine', 'Hugo', 'Mathieu', 'Kevin', 'Romain', 'Pierre', 'Philippe', 'Olivier', 'Rachid', 'Benoît', 'Sébastien', 'Laurent', 'François', 'Yann', 'David', 'Jérôme', 'Bruno', 'Paul', 'Samir']
const LAST = ['Martin', 'Bernard', 'Dubois', 'Durand', 'Lefebvre', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Garcia', 'Roux', 'Fournier', 'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Lefèvre', 'Faure', 'André', 'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Garnier', 'Chevalier', 'François', 'Legrand', 'Gauthier', 'Perrin', 'Robin', 'Clément', 'Morin', 'Nicolas', 'Henry', 'Roussel', 'Mathieu', 'Gaillard', 'Brunet', 'Benali', 'Nguyen', 'Da Silva', 'Haddad', 'Meyer', 'Caron', 'Renaud', 'Barbier']

const TECH_COLORS = ['#c2410c', '#1d4ed8', '#0f766e', '#a16207', '#7c3aed', '#be185d']

const COMMENTS_GOOD = [
  'Intervention rapide et prix annoncé respecté. Je recommande.',
  'Technicien ponctuel, très professionnel et rassurant.',
  'Arrivé en 25 minutes un dimanche soir, travail propre.',
  "Devis clair avant l'intervention, aucune mauvaise surprise.",
  'Très bon contact, explications claires. Merci !',
  'Le suivi par SMS est vraiment pratique, on sait quand il arrive.',
  'Efficace et courtois. Tarif conforme au devis signé.',
]
const COMMENTS_MID = ["Bon travail mais un peu d'attente au téléphone.", 'Correct, mais le créneau annoncé a glissé de 30 minutes.']
const COMMENTS_BAD = ['Retard important sans prévenir.', 'Prix plus élevé que ce que j’imaginais, même si le devis était clair.']

// ——— Configuration des deux entreprises ———
interface CompanyConfig {
  company: Company
  areas: Area[]
  techs: { first: string; last: string; skills: string[]; vehicle: string }[]
  pros: { name: string; type: ClientType; contact: [string, string] }[]
  problems: [string, number][]
  lambdaWeek: number
  lambdaWeekend: number
  nightShare: number
  seed: number
}

const CONFIGS: CompanyConfig[] = [
  {
    seed: 6901,
    company: {
      id: 'cmp_lyon',
      name: 'Serrurerie Saint-Clair',
      shortName: 'Saint-Clair',
      legalName: 'Saint-Clair Dépannage SAS (fictive)',
      trades: ['serrurerie'],
      city: 'Lyon',
      center: { lat: 45.758, lng: 4.845 },
      phone: '+33199001234',
      email: 'contact@saint-clair.example.com',
      siret: '000 000 001 00011',
      vatNumber: 'FR00 000000001',
      address: '14 grande rue de Saint-Clair, 69300 Caluire-et-Cuire',
      insurance: 'RC Pro et décennale n° DEMO-4471 — Assureur fictif',
      hourlyRateCents: 6500,
      brandColor: '#c2410c',
      googleRating: 4.8,
      googleReviewCount: 312,
      postalCodes: LYON.map((a) => a.cp),
    },
    areas: LYON,
    techs: [
      { first: 'Karim', last: 'Benali', skills: ['Ouverture de porte', 'Remplacement de serrure', 'Effraction', 'Porte blindée'], vehicle: 'Kangoo — GH-412-PL' },
      { first: 'Julien', last: 'Morel', skills: ['Ouverture de porte', 'Remplacement de serrure'], vehicle: 'Berlingo — FT-881-KA' },
      { first: 'Sofiane', last: 'Haddad', skills: ['Ouverture de porte', 'Effraction', 'Remplacement de serrure'], vehicle: 'Kangoo — GJ-207-RT' },
      { first: 'Thomas', last: 'Girard', skills: ['Ouverture de porte', 'Porte blindée', 'Remplacement de serrure'], vehicle: 'Trafic — FX-530-BB' },
      { first: 'Mehdi', last: 'Lambert', skills: ['Ouverture de porte', 'Remplacement de serrure'], vehicle: 'Partner — GA-118-ZD' },
      { first: 'Lucas', last: 'Fontaine', skills: ['Ouverture de porte', 'Effraction'], vehicle: 'Kangoo — GK-904-MC' },
    ],
    pros: [
      { name: 'Syndic Bellecour Gestion', type: 'syndic', contact: ['Hélène', 'Vasseur'] },
      { name: 'Régie des Terreaux', type: 'agence_immobiliere', contact: ['Marc', 'Delorme'] },
      { name: 'Agence Croix-Rousse Immobilier', type: 'agence_immobiliere', contact: ['Sandrine', 'Pagès'] },
      { name: 'Assistance Habitat Rhône (fictif)', type: 'assureur', contact: ['Plateforme', 'Assistance'] },
      { name: 'Boulangerie du Plateau', type: 'professionnel', contact: ['Didier', 'Chalamet'] },
    ],
    problems: [['porte_claquee', 34], ['porte_fermee', 22], ['cle_cassee', 9], ['serrure_cassee', 13], ['effraction', 8], ['changement_cylindre', 12], ['blindage', 2]],
    lambdaWeek: 5.6,
    lambdaWeekend: 6.4,
    nightShare: 0.28,
  },
  {
    seed: 3301,
    company: {
      id: 'cmp_bdx',
      name: 'Plomberie Garonne Services',
      shortName: 'Garonne',
      legalName: 'Garonne Services SARL (fictive)',
      trades: ['plomberie', 'chauffage'],
      city: 'Bordeaux',
      center: { lat: 44.84, lng: -0.58 },
      phone: '+33199005678',
      email: 'contact@garonne-services.example.com',
      siret: '000 000 002 00012',
      vatNumber: 'FR00 000000002',
      address: '52 cours de la Marne, 33800 Bordeaux',
      insurance: 'RC Pro et décennale n° DEMO-8820 — Assureur fictif',
      hourlyRateCents: 6200,
      brandColor: '#1d4ed8',
      googleRating: 4.6,
      googleReviewCount: 187,
      postalCodes: BORDEAUX.map((a) => a.cp),
    },
    areas: BORDEAUX,
    techs: [
      { first: 'Nicolas', last: 'Dubos', skills: ['Fuite', 'Débouchage', 'Chauffe-eau', 'Chaudière gaz'], vehicle: 'Trafic — GB-771-LN' },
      { first: 'Antoine', last: 'Lacoste', skills: ['Fuite', 'Chauffe-eau', 'Chaudière gaz'], vehicle: 'Kangoo — FZ-302-HV' },
      { first: 'Yanis', last: 'Ferreira', skills: ['Fuite', 'Débouchage'], vehicle: 'Jumpy — GE-640-SA' },
      { first: 'Romain', last: 'Castaing', skills: ['Chaudière gaz', 'Chauffe-eau', 'Fuite'], vehicle: 'Berlingo — GH-095-TT' },
    ],
    pros: [
      { name: 'Syndic des Chartrons', type: 'syndic', contact: ['Isabelle', 'Lartigue'] },
      { name: 'Agence Pey-Berland Immobilier', type: 'agence_immobiliere', contact: ['Olivier', 'Darrieux'] },
      { name: 'Régie Bastide Gestion', type: 'agence_immobiliere', contact: ['Nadia', 'Cazenave'] },
      { name: 'Assistance Habitat Sud-Ouest (fictif)', type: 'assureur', contact: ['Plateforme', 'Assistance'] },
      { name: 'Restaurant Le Quai 33', type: 'professionnel', contact: ['Jean', 'Labat'] },
    ],
    problems: [['fuite_eau', 26], ['wc_bouche', 18], ['canalisation', 12], ['chauffe_eau', 16], ['degat_eaux', 7], ['chaudiere_panne', 13], ['entretien_chaudiere', 8]],
    lambdaWeek: 4.4,
    lambdaWeekend: 2.6,
    nightShare: 0.1,
  },
]

// ——— Contexte de génération ———
class Builder {
  ds: Dataset
  r: Rng
  cfg: CompanyConfig
  now: number
  usedPhones = new Set<string>()
  techLoad = new Map<string, number>()

  constructor(cfg: CompanyConfig, now: number) {
    this.cfg = cfg
    this.now = now
    this.r = new Rng(cfg.seed)
    this.ds = {
      company: cfg.company,
      technicians: [],
      clients: [],
      requests: [],
      calls: [],
      quotes: [],
      jobs: [],
      invoices: [],
      sms: [],
      reviews: [],
      events: [],
      webhooks: [],
      deliveries: [],
      apiKeys: [],
      templates: [],
      automations: [],
      stock: [],
      counters: { request: 0, quote: 0, invoice: 0 },
    }
  }

  id(prefix: string) {
    return `${prefix}_${this.cfg.company.id.slice(4)}_${Math.floor(this.r.next() * 1e9).toString(36)}`
  }

  phone() {
    let p = ''
    do {
      p = `+3363998${String(this.r.int(0, 9999)).padStart(4, '0')}`
    } while (this.usedPhones.has(p))
    this.usedPhones.add(p)
    return p
  }

  address(area?: Area): Address {
    const a = area ?? this.r.pick(this.cfg.areas)
    const housing = this.r.weighted([['appartement', 70], ['maison', 22], ['local_pro', 5], ['parties_communes', 3]] as const)
    return {
      id: this.id('adr'),
      line1: `${this.r.int(1, 148)} ${this.r.pick(a.streets)}`,
      postalCode: a.cp,
      city: a.city,
      location: { lat: a.lat + this.r.real(-0.009, 0.009), lng: a.lng + this.r.real(-0.012, 0.012) },
      housingType: housing,
      floor: housing === 'appartement' ? (() => { const f = this.r.int(0, 7); return f === 0 ? 'rez-de-chaussée' : f === 1 ? '1er étage' : `${f}e étage` })() : undefined,
      doorCode: housing === 'appartement' && this.r.chance(0.6) ? `${this.r.int(1000, 9999)}${this.r.pick(['A', 'B', ''])}` : undefined,
      intercom: housing === 'appartement' && this.r.chance(0.5) ? this.r.pick(LAST) : undefined,
    }
  }

  client(at: number, type: ClientType = 'particulier'): Client {
    const female = this.r.chance(0.5)
    const c: Client = {
      id: this.id('cli'),
      companyId: this.cfg.company.id,
      type,
      firstName: this.r.pick(female ? FIRST_F : FIRST_M),
      lastName: this.r.pick(LAST),
      phone: this.phone(),
      tags: [],
      addresses: [this.address()],
      createdAt: at,
      smsOptOut: this.r.chance(0.01),
    }
    c.email = this.r.chance(0.7) ? `${c.firstName}.${c.lastName}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z.]/g, '') + '@example.com' : undefined
    this.ds.clients.push(c)
    return c
  }

  setup() {
    const { company } = this.cfg
    this.ds.technicians = this.cfg.techs.map((t, i) => ({
      id: `tec_${company.id.slice(4)}_${i + 1}`,
      companyId: company.id,
      firstName: t.first,
      lastName: t.last,
      phone: this.phone(),
      color: TECH_COLORS[i % TECH_COLORS.length],
      skills: t.skills,
      vehicle: t.vehicle,
      onCall: i === 0,
      active: true,
      position: { lat: company.center.lat + this.r.real(-0.03, 0.03), lng: company.center.lng + this.r.real(-0.04, 0.04) },
      shareLocation: true,
    }))
    // Donneurs d'ordre (clients professionnels)
    for (const p of this.cfg.pros) {
      const c = this.client(this.now - 300 * DAY, p.type)
      c.companyName = p.name
      c.firstName = p.contact[0]
      c.lastName = p.contact[1]
      c.tags = ['donneur d’ordre', ...(p.type === 'syndic' ? ['paiement à 30 jours'] : [])]
      c.email = `${p.contact[0].toLowerCase()}@${p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '').slice(0, 14)}.example.com`
      c.addresses = [this.address(), this.address(), this.address()]
      c.notes = p.type === 'assureur' ? 'Plateforme d’assistance : facturer avec le numéro de dossier.' : 'Bon de commande requis au-delà de 300 € TTC.'
    }
    // Stock véhicule
    const parts = PROBLEM_TYPES.filter((p) => company.trades.includes(p.trade)).flatMap((p) => [...p.items, ...p.optional]).map((i) => i.code)
    const partCodes = [...new Set(parts)].filter((c) => !c.startsWith('MO') && !c.startsWith('DEP') && /CYL|SER-|JOINT|MITIGEUR|GRP|RES|PIECE/.test(c))
    for (const t of this.ds.technicians) {
      for (const code of partCodes) {
        const min = code === 'JOINT' ? 10 : 2
        this.ds.stock.push({ technicianId: t.id, code, qty: this.r.chance(0.18) ? this.r.int(0, min - 1) : this.r.int(min, min + 6), min })
      }
    }
  }

  ref(kind: 'request' | 'quote' | 'invoice', at: number) {
    const y = new Date(at).getFullYear()
    const v = ++this.ds.counters[kind]
    const p = kind === 'request' ? 'DEM' : kind === 'quote' ? 'DEV' : 'FAC'
    return `${p}-${y}-${String(v).padStart(kind === 'invoice' ? 6 : 5, '0')}`
  }

  techFor(problemCode: string, at: number) {
    const skill = problemByCode[problemCode].skill
    const skilled = this.ds.technicians.filter((t) => t.skills.includes(skill))
    const pool = skilled.length ? skilled : this.ds.technicians
    // Charge équilibrée avec une préférence pour les plus expérimentés
    const day = Math.floor(at / DAY)
    return pool.slice().sort((a, b) => (this.techLoad.get(`${a.id}${day}`) ?? 0) - (this.techLoad.get(`${b.id}${day}`) ?? 0) + this.r.real(-0.8, 0.8))[0]
  }

  sms(client: Client, requestId: string | undefined, at: number, body: string, template: string, direction: 'sortant' | 'entrant' = 'sortant') {
    this.ds.sms.push({
      id: this.id('sms'),
      companyId: this.cfg.company.id,
      clientId: client.id,
      requestId,
      direction,
      body,
      at,
      status: direction === 'entrant' ? 'recu' : 'distribue',
      template,
      by: direction === 'entrant' ? 'client' : 'automatisation',
    })
  }

  aiFor(problemCode: string, urgency: Urgency, complexity: number, estimate: { minCents: number; maxCents: number }, at: number, review: AiProposal['reviewStatus']): AiProposal {
    const pt = problemByCode[problemCode]
    return {
      summary: `${pt.label}. ${urgency === 'absolue' ? 'Client bloqué, demande une intervention immédiate.' : 'Intervention souhaitée rapidement.'}`,
      problemTypeCode: problemCode,
      urgency,
      complexity,
      durationMin: pt.durationMin,
      priceMinCents: estimate.minCents,
      priceMaxCents: estimate.maxCents,
      confidence: Math.round(this.r.real(0.72, 0.98) * 100) / 100,
      agent: 'n8n · agent-qualification v1.3',
      processedAt: at + this.r.int(20, 90) * 1000,
      reviewStatus: review,
    }
  }

  /** Crée une demande (+ appel associé) à l'instant donné. */
  request(opts: { at: number; client?: Client; problem?: string; urgency?: Urgency; source?: RequestSource; status?: RequestStatus; withAi?: boolean }): ServiceRequest {
    const { at } = opts
    const company = this.cfg.company
    const client = opts.client ?? (this.ds.clients.length > 30 && this.r.chance(0.24) ? this.r.pick(this.ds.clients) : this.client(at))
    const problem = opts.problem ?? this.r.weighted(this.cfg.problems)
    const pt = problemByCode[problem]
    const urgency: Urgency =
      opts.urgency ??
      (problem === 'entretien_chaudiere'
        ? 'planifiee'
        : pt.trade === 'serrurerie' && pt.complexity <= 2
          ? this.r.weighted([['absolue', 60], ['moins_2h', 35], ['dans_la_journee', 5]] as const)
          : this.r.weighted([['absolue', 12], ['moins_2h', 38], ['dans_la_journee', 38], ['planifiee', 12]] as const))
    const complexity = Math.min(5, pt.complexity + (this.r.chance(0.25) ? 1 : 0))
    const address = this.r.pick(client.addresses)
    const estimate = estimatePrice({ company, problemTypeCode: problem, complexity, urgency, at: new Date(at), address })
    const source = opts.source ?? this.r.weighted([['appel', 66], ['appel_manque', 12], ['sms', 5], ['web', 11], ['api', 6]] as const)
    const req: ServiceRequest = {
      id: this.id('req'),
      companyId: company.id,
      ref: this.ref('request', at),
      clientId: client.id,
      addressId: address.id,
      source,
      trade: pt.trade as Trade,
      problemTypeCode: problem,
      urgency,
      description: this.describe(problem, address),
      complexity,
      durationMin: pt.durationMin,
      estimate,
      status: opts.status ?? 'nouvelle',
      history: [{ status: 'nouvelle', at, actor: source === 'api' ? 'API (n8n)' : 'Standard' }],
      createdAt: at,
      media: [],
      notes: [],
    }
    const aiEra = at > this.now - 70 * DAY
    if (opts.withAi ?? (aiEra && this.r.chance(0.7))) {
      req.ai = this.aiFor(problem, urgency, complexity, estimate, at, this.r.weighted([['accepted', 75], ['edited', 20], ['rejected', 5]] as const))
    }
    if (source === 'appel' || source === 'appel_manque') {
      const missed = source === 'appel_manque'
      const call: Call = {
        id: this.id('call'),
        companyId: company.id,
        from: client.phone,
        clientId: client.id,
        requestId: req.id,
        status: missed ? (aiEra && this.r.chance(0.5) ? 'agent_ia' : this.r.chance(0.6) ? 'manque' : 'messagerie') : 'repondu',
        at,
        durationSec: missed ? this.r.int(0, 40) : this.r.int(60, 420),
        waitSec: missed ? this.r.int(20, 35) : this.r.int(3, 28),
        answeredBy: missed ? undefined : this.r.pick(['Sandrine (secrétariat)', this.ds.technicians[0].firstName + ' (astreinte)']),
        recording: !missed,
        missedSmsSent: missed,
      }
      if (call.status === 'agent_ia') call.durationSec = this.r.int(70, 180)
      if (aiEra && call.status !== 'manque') {
        call.aiSummary = `${pt.label} — ${address.line1}, ${address.city}. ${urgency === 'absolue' ? 'Urgence : client bloqué.' : 'Souhaite un passage rapidement.'}`
        call.transcript = this.transcript(problem, address, client)
      }
      this.ds.calls.push(call)
      req.callId = call.id
      if (missed) {
        this.sms(client, req.id, at + 40 * 1000, `${company.shortName} : nous avons bien reçu votre appel. Décrivez votre problème et envoyez une photo ici : https://urgencepro.example/c/•••`, 'missed_call')
      }
    }
    this.ds.requests.push(req)
    return req
  }

  describe(problem: string, a: Address) {
    const d: Record<string, string[]> = {
      porte_claquee: ['Porte claquée en sortant, clés à l’intérieur.', 'Porte claquée, enfant de 3 ans seul à l’intérieur — très urgent.', 'Porte palière claquée, clés restées sur la table.'],
      porte_fermee: ['Clés perdues, porte fermée à double tour.', 'Clés volées avec mon sac, porte fermée à clé.'],
      cle_cassee: ['La clé s’est cassée dans la serrure, un morceau reste coincé.'],
      serrure_cassee: ['La serrure tourne dans le vide, impossible de fermer.', 'Serrure bloquée, la clé ne tourne plus.'],
      effraction: ['Tentative d’effraction cette nuit, cylindre forcé, porte ne ferme plus.', 'Cambriolage, porte fracturée. Besoin de sécuriser au plus vite (déclaration assurance en cours).'],
      changement_cylindre: ['Je viens d’emménager et veux changer le cylindre.', 'Changement de cylindre après perte de clés.'],
      blindage: ['Porte blindée bloquée, la clé tourne mais rien ne se passe.'],
      fuite_eau: ['Fuite sous l’évier, ça goutte en continu.', 'Fuite au niveau du raccord de la machine à laver.'],
      wc_bouche: ['WC bouchés, l’eau remonte.', 'Toilettes bouchées, ventouse sans effet.'],
      canalisation: ['Évacuation de la douche et de l’évier bouchées.', 'Odeurs et refoulement dans la cuisine.'],
      chauffe_eau: ['Plus d’eau chaude depuis ce matin.', 'Le groupe de sécurité du ballon fuit en continu.'],
      degat_eaux: ['Tache d’humidité au plafond, le voisin du dessous signale une fuite.', 'Dégât des eaux, l’assurance demande une recherche de fuite.'],
      chaudiere_panne: ['Chaudière en défaut, plus de chauffage ni d’eau chaude.', 'La chaudière se met en sécurité toutes les 10 minutes.'],
      entretien_chaudiere: ['Entretien annuel de la chaudière gaz.'],
    }
    const base = this.r.pick(d[problem] ?? ['Intervention demandée.'])
    return a.floor ? `${base} ${a.floor}.` : base
  }

  transcript(problem: string, a: Address, c: Client) {
    const pt = problemByCode[problem]
    return [
      `Standard : ${this.cfg.company.name}, bonjour. Cet appel peut être enregistré pour la qualité du service.`,
      `Client : Bonjour, ${pt.label.toLowerCase()}, j’ai besoin de quelqu’un vite.`,
      `Standard : Je note. Quelle est l’adresse exacte ?`,
      `Client : ${a.line1}, ${a.postalCode} ${a.city}${a.floor ? `, ${a.floor}` : ''}.`,
      `Standard : Très bien Monsieur/Madame ${c.lastName}. Vous allez recevoir un SMS avec le tarif estimé et l’heure d’arrivée.`,
    ].join('\n')
  }

  /** Fait vivre une demande historique jusqu'à son issue. */
  lifecycle(req: ServiceRequest) {
    const r = this.r
    const at = req.createdAt
    const company = this.cfg.company
    const client = this.ds.clients.find((c) => c.id === req.clientId)!
    const address = client.addresses.find((a) => a.id === req.addressId)!
    const push = (status: RequestStatus, t: number, actor = 'Sandrine (secrétariat)', reason?: string) => {
      req.status = status
      req.history.push({ status, at: t, actor, reason })
    }
    const qualifiedAt = at + r.int(2, req.urgency === 'absolue' ? 5 : 12) * MINUTE
    // Perdues avant devis
    if (r.chance(0.11)) {
      push('qualifiee', qualifiedAt)
      const reason = r.pick(['Client injoignable', 'Problème résolu seul', 'Délai trop long', 'Hors zone'])
      req.lostReason = reason
      push('perdue', qualifiedAt + r.int(10, 120) * MINUTE, 'Sandrine (secrétariat)', reason)
      return
    }
    push('qualifiee', qualifiedAt)
    if (req.photoLinkSentAt === undefined && r.chance(0.45)) {
      req.photoLinkSentAt = at + 3 * MINUTE
      const n = r.int(1, 3)
      for (let i = 0; i < n; i++) req.media.push(this.media(req, 'client', at + r.int(5, 14) * MINUTE))
      req.locationShared = { at: at + r.int(5, 14) * MINUTE, method: r.chance(0.7) ? 'gps' : 'adresse' }
    }
    const needsQuote = req.estimate.maxCents > 15000 || req.urgency === 'planifiee' || r.chance(0.3)
    let quote: Quote | undefined
    let acceptedAt = qualifiedAt
    if (needsQuote) {
      const sentAt = qualifiedAt + r.int(2, req.urgency === 'absolue' ? 8 : 25) * MINUTE
      quote = this.quote(req, address, sentAt)
      push('devis_envoye', sentAt)
      const urgent = req.urgency === 'absolue' || req.urgency === 'moins_2h'
      quote.viewedAt = sentAt + (urgent ? r.int(1, 8) : r.int(2, 60)) * MINUTE
      const signed = r.chance(req.urgency === 'planifiee' ? 0.62 : 0.8)
      if (!signed) {
        quote.status = r.chance(0.6) ? 'refuse' : 'expire'
        req.lostReason = quote.status === 'refuse' ? r.pick(['Prix jugé trop élevé', 'A trouvé un autre artisan']) : 'Devis non signé'
        if (quote.status === 'expire') quote.reminders = [sentAt + DAY, sentAt + 3 * DAY, sentAt + 7 * DAY]
        push('perdue', sentAt + r.int(1, 8) * DAY, 'Automatisation', req.lostReason)
        return
      }
      acceptedAt = quote.viewedAt + r.int(1, req.urgency === 'planifiee' ? 2000 : urgent ? 6 : 30) * MINUTE
      quote.status = 'signe'
      quote.signedAt = acceptedAt
      quote.signerName = `${client.firstName} ${client.lastName}`
      if (quote.signedAt - sentAt > DAY) quote.reminders = [sentAt + DAY]
      push('acceptee', acceptedAt, 'Client (signature en ligne)')
    }
    if (r.chance(0.025)) {
      push('annulee', acceptedAt + 20 * MINUTE, 'Sandrine (secrétariat)', 'Annulation du client')
      return
    }
    // Planification
    const tech = this.techFor(req.problemTypeCode, acceptedAt)
    const delay =
      req.urgency === 'absolue' ? r.int(22, 45) : req.urgency === 'moins_2h' ? r.int(40, 95) : req.urgency === 'dans_la_journee' ? r.int(150, 420) : r.int(1, 6) * 1440 + r.int(0, 300)
    let start = acceptedAt + delay * MINUTE
    if (req.urgency === 'planifiee') {
      const d = new Date(start)
      d.setHours(r.int(8, 16), r.pick([0, 30]), 0, 0)
      start = Math.max(d.getTime(), acceptedAt + HOUR)
    }
    if (start > this.now - 2 * HOUR) start = Math.min(acceptedAt + r.int(30, 90) * MINUTE, this.now - 2 * HOUR - r.int(5, 60) * MINUTE)
    const duration = Math.round(problemByCode[req.problemTypeCode].durationMin * r.real(0.75, 1.45))
    const enRouteAt = start - r.int(12, 32) * MINUTE
    const job: Job = {
      id: this.id('job'),
      companyId: company.id,
      requestId: req.id,
      technicianId: tech.id,
      status: 'terminee',
      start,
      durationMin: duration,
      enRouteAt,
      arrivedAt: start + r.int(-5, 14) * MINUTE,
      completedAt: start + duration * MINUTE,
    }
    job.report = {
      workDone: problemByCode[req.problemTypeCode].label + ' — intervention réalisée.',
      observations: '',
      parts: [],
      durationMin: duration,
      photos: [],
      signerName: `${client.firstName} ${client.lastName}`,
    }
    const dayKey = `${tech.id}${Math.floor(start / DAY)}`
    this.techLoad.set(dayKey, (this.techLoad.get(dayKey) ?? 0) + 1)
    this.ds.jobs.push(job)
    req.jobId = job.id
    push('planifiee', acceptedAt + r.int(1, 6) * MINUTE)
    this.sms(client, req.id, acceptedAt + 5 * MINUTE, `${company.shortName} : votre demande est prise en charge. ${tech.firstName} interviendra vers ${new Date(start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`, 'confirmation')
    push('en_route', enRouteAt, `${tech.firstName} ${tech.lastName}`)
    this.sms(client, req.id, enRouteAt, `${company.shortName} : ${tech.firstName} est en route. Suivez son arrivée : https://urgencepro.example/c/•••`, 'en_route')
    push('sur_place', job.arrivedAt!, `${tech.firstName} ${tech.lastName}`)
    push('terminee', job.completedAt!, `${tech.firstName} ${tech.lastName}`)
    // Facture
    const lines = quote ? quote.lines.map((l) => ({ ...l })) : quoteLinesFor({ problemTypeCode: req.problemTypeCode, urgency: req.urgency, at: new Date(start), address, company, includeOptional: r.chance(0.35) })
    const inv = this.invoice(req, client, lines, job.completedAt! + r.int(2, 20) * MINUTE, tech.id)
    push('facturee', inv.issuedAt, `${tech.firstName} ${tech.lastName}`)
    const total = totals(inv.lines).ttc
    const isPro = client.type !== 'particulier'
    const age = this.now - inv.issuedAt
    let paidAt: number | undefined
    let method: PaymentMethod = 'cb_terminal'
    if (isPro) {
      const after = r.int(12, 50) * DAY
      if (inv.issuedAt + after < this.now) {
        paidAt = inv.issuedAt + after
        method = 'virement'
      }
    } else if (r.chance(0.84)) {
      paidAt = inv.issuedAt + r.int(1, 10) * MINUTE
      method = r.weighted([['cb_terminal', 52], ['cb_en_ligne', 22], ['cheque', 14], ['especes', 12]] as const)
    } else {
      const after = r.int(1, 12) * DAY
      if (age > after && r.chance(age > 20 * DAY ? 0.95 : 0.6)) {
        paidAt = inv.issuedAt + after
        method = 'cb_en_ligne'
      }
    }
    if (paidAt) {
      inv.payments.push({ id: this.id('pay'), amountCents: total, method, at: paidAt })
      inv.status = 'payee'
      push('payee', paidAt, method === 'cb_en_ligne' ? 'Stripe' : `${tech.firstName} ${tech.lastName}`)
      if (this.now - paidAt > 5 * DAY) push('cloturee', paidAt + 2 * DAY, 'Automatisation')
    } else {
      inv.status = this.now > inv.dueAt ? 'en_retard' : 'emise'
    }
    // Avis
    if (r.chance(0.55)) {
      const rating = r.weighted([[5, 70], [4, 19], [3, 6], [2, 3], [1, 2]] as const)
      const review: Review = {
        id: this.id('rev'),
        companyId: company.id,
        requestId: req.id,
        clientId: client.id,
        technicianId: tech.id,
        source: r.chance(0.32) ? 'google' : 'interne',
        rating,
        comment: rating >= 4 ? r.pick(COMMENTS_GOOD) : rating === 3 ? r.pick(COMMENTS_MID) : r.pick(COMMENTS_BAD),
        author: `${client.firstName} ${client.lastName[0]}.`,
        at: job.completedAt! + r.int(2, 30) * HOUR,
      }
      if (review.source === 'google' && r.chance(0.6)) review.reply = `Merci ${client.firstName} pour votre retour, au plaisir de vous aider à nouveau.`
      this.ds.reviews.push(review)
      req.reviewId = review.id
      this.sms(client, req.id, job.completedAt! + 2 * HOUR, `${company.shortName} : merci pour votre confiance. Votre avis nous aide beaucoup : https://urgencepro.example/c/•••`, 'review_request')
    }
  }

  media(req: ServiceRequest, category: Media['category'], at: number): Media {
    const arts: Record<string, string[]> = {
      porte_claquee: ['porte', 'serrure'], porte_fermee: ['porte', 'serrure'], cle_cassee: ['cylindre', 'serrure'], serrure_cassee: ['serrure', 'porte'],
      effraction: ['effraction', 'cylindre', 'porte'], changement_cylindre: ['cylindre'], blindage: ['porte', 'serrure'],
      fuite_eau: ['fuite', 'evier'], wc_bouche: ['wc'], canalisation: ['evier', 'fuite'], chauffe_eau: ['ballon'], degat_eaux: ['plafond', 'fuite'],
      chaudiere_panne: ['chaudiere'], entretien_chaudiere: ['chaudiere'],
    }
    const captions: Record<string, string> = {
      porte: 'Porte palière', serrure: 'Serrure vue de face', cylindre: 'Cylindre endommagé', effraction: 'Traces d’effraction', fuite: 'Fuite visible',
      evier: 'Sous l’évier', wc: 'WC', ballon: 'Chauffe-eau', plafond: 'Tache au plafond', chaudiere: 'Écran de la chaudière (code défaut)',
    }
    const art = this.r.pick(arts[req.problemTypeCode] ?? ['porte'])
    return { id: this.id('med'), requestId: req.id, kind: 'photo', category, caption: captions[art], art, at }
  }

  quote(req: ServiceRequest, address: Address, at: number): Quote {
    const company = this.cfg.company
    const q: Quote = {
      id: this.id('quo'),
      companyId: company.id,
      ref: this.ref('quote', at),
      requestId: req.id,
      clientId: req.clientId,
      status: 'envoye',
      lines: quoteLinesFor({ problemTypeCode: req.problemTypeCode, urgency: req.urgency, at: new Date(at), address, company, includeOptional: req.complexity >= 3 }),
      createdAt: at - 4 * MINUTE,
      sentAt: at,
      validUntil: at + 30 * DAY,
      depositPercent: req.urgency === 'planifiee' ? 30 : 0,
      urgentWaiver: req.urgency !== 'planifiee',
      aiDraft: !!req.ai,
      reminders: [],
    }
    this.ds.quotes.push(q)
    req.quoteId = q.id
    return q
  }

  invoice(req: ServiceRequest, client: Client, lines: Invoice['lines'], at: number, techId?: string): Invoice {
    const inv: Invoice = {
      id: this.id('inv'),
      companyId: this.cfg.company.id,
      ref: this.ref('invoice', at),
      requestId: req.id,
      clientId: client.id,
      technicianId: techId,
      kind: 'facture',
      status: 'emise',
      lines,
      issuedAt: at,
      dueAt: at + (client.type === 'particulier' ? 15 : 30) * DAY,
      payments: [],
    }
    this.ds.invoices.push(inv)
    req.invoiceId = inv.id
    return inv
  }

  /** Six mois d'historique, jour par jour, jusqu'à hier. */
  history() {
    const r = this.r
    const today0 = new Date(this.now)
    today0.setHours(0, 0, 0, 0)
    for (let d = 182; d >= 1; d--) {
      const dayStart = today0.getTime() - d * DAY
      const wd = new Date(dayStart).getDay()
      const weekend = wd === 0 || wd === 6
      const month = new Date(dayStart).getMonth()
      // Saisonnalité : chauffage en hausse à l'automne, croissance progressive de l'activité
      const growth = 0.82 + (182 - d) / 182 * 0.3
      const season = this.cfg.company.trades.includes('chauffage') && (month >= 8 || month <= 2) ? 1.25 : 1
      const count = r.poisson((weekend ? this.cfg.lambdaWeekend : this.cfg.lambdaWeek) * growth * season)
      for (let i = 0; i < count; i++) {
        const night = r.chance(this.cfg.nightShare)
        const hour = night ? r.pick([20, 21, 22, 23, 0, 1, 6, 7]) : r.int(8, 19)
        const at = dayStart + hour * HOUR + r.int(0, 59) * MINUTE
        const req = this.request({ at })
        this.lifecycle(req)
      }
      // Appels sans suite (faux numéros, démarchage, demandes d'information)
      for (let i = 0; i < r.poisson(1.1); i++) {
        const at = dayStart + r.int(8, 20) * HOUR + r.int(0, 59) * MINUTE
        this.ds.calls.push({ id: this.id('call'), companyId: this.cfg.company.id, from: this.phone(), status: r.chance(0.7) ? 'repondu' : 'manque', at, durationSec: r.int(10, 140), waitSec: r.int(4, 30), recording: true })
      }
    }
  }

  // ——— Journée en cours, scénarisée pour la démo ———
  today() {
    const r = this.r
    const now = this.now
    const company = this.cfg.company
    const techs = this.ds.technicians
    const P = this.cfg.problems.map(([p]) => p)
    const lyon = company.city === 'Lyon'
    const emit = (type: string, at: number, summary: string, entityId?: string, actor = 'Système') =>
      this.ds.events.push({ id: this.id('evt'), companyId: company.id, type, at, summary, entityId, actor })

    const dayStart = new Date(now)
    dayStart.setHours(0, 0, 0, 0)
    const morning = Math.max(dayStart.getTime() + 7.5 * HOUR, now - 9 * HOUR)

    // Interventions terminées plus tôt dans la journée (remplissent le planning)
    techs.forEach((t, i) => {
      const n = i < 2 ? 2 : 1
      for (let k = 0; k < n; k++) {
        const at = morning + (k * 2.6 + i * 0.4) * HOUR
        if (at > now - 2.5 * HOUR) continue
        const req = this.request({ at, problem: r.pick(P), urgency: 'moins_2h' })
        this.lifecycle(req)
        const job = this.ds.jobs.find((j) => j.id === req.jobId)
        if (job) {
          job.technicianId = t.id
          job.start = at + 50 * MINUTE
          job.enRouteAt = job.start - 20 * MINUTE
          job.arrivedAt = job.start
          job.completedAt = Math.min(job.start + job.durationMin * MINUTE, now - 20 * MINUTE)
        }
      }
    })

    const cl = () => this.client(now - r.int(1, 400) * DAY)
    const scenario: { key: string; problem: string; urgency: Urgency; ago: number; source: RequestSource }[] = lyon
      ? [
          { key: 'missed', problem: 'porte_claquee', urgency: 'absolue', ago: 6, source: 'appel_manque' },
          { key: 'ai', problem: 'porte_fermee', urgency: 'absolue', ago: 12, source: 'appel' },
          { key: 'qualified', problem: 'effraction', urgency: 'absolue', ago: 24, source: 'appel' },
          { key: 'quote_viewed', problem: 'serrure_cassee', urgency: 'dans_la_journee', ago: 140, source: 'web' },
          { key: 'quote_old', problem: 'changement_cylindre', urgency: 'planifiee', ago: 26 * 60, source: 'appel' },
          { key: 'accepted', problem: 'blindage', urgency: 'moins_2h', ago: 48, source: 'appel' },
          { key: 'planned', problem: 'serrure_cassee', urgency: 'dans_la_journee', ago: 95, source: 'api' },
          { key: 'offered', problem: 'cle_cassee', urgency: 'moins_2h', ago: 30, source: 'sms' },
          { key: 'en_route', problem: 'porte_claquee', urgency: 'absolue', ago: 34, source: 'appel' },
          { key: 'on_site', problem: 'effraction', urgency: 'absolue', ago: 75, source: 'appel' },
          { key: 'done', problem: 'porte_fermee', urgency: 'moins_2h', ago: 150, source: 'appel' },
          { key: 'invoiced', problem: 'changement_cylindre', urgency: 'dans_la_journee', ago: 260, source: 'web' },
        ]
      : [
          { key: 'missed', problem: 'fuite_eau', urgency: 'moins_2h', ago: 6, source: 'appel_manque' },
          { key: 'ai', problem: 'chaudiere_panne', urgency: 'moins_2h', ago: 12, source: 'appel' },
          { key: 'qualified', problem: 'degat_eaux', urgency: 'dans_la_journee', ago: 24, source: 'appel' },
          { key: 'quote_viewed', problem: 'chauffe_eau', urgency: 'dans_la_journee', ago: 140, source: 'web' },
          { key: 'quote_old', problem: 'entretien_chaudiere', urgency: 'planifiee', ago: 26 * 60, source: 'appel' },
          { key: 'accepted', problem: 'canalisation', urgency: 'moins_2h', ago: 48, source: 'appel' },
          { key: 'planned', problem: 'chauffe_eau', urgency: 'dans_la_journee', ago: 95, source: 'api' },
          { key: 'offered', problem: 'wc_bouche', urgency: 'moins_2h', ago: 30, source: 'sms' },
          { key: 'en_route', problem: 'fuite_eau', urgency: 'absolue', ago: 34, source: 'appel' },
          { key: 'on_site', problem: 'wc_bouche', urgency: 'moins_2h', ago: 75, source: 'appel' },
          { key: 'done', problem: 'fuite_eau', urgency: 'moins_2h', ago: 150, source: 'appel' },
          { key: 'invoiced', problem: 'chauffe_eau', urgency: 'dans_la_journee', ago: 260, source: 'web' },
        ]

    const byKey: Record<string, ServiceRequest> = {}
    for (const s of scenario) {
      const at = now - s.ago * MINUTE
      const client = s.key === 'ai' ? this.ds.clients.find((c) => c.type === 'particulier' && this.ds.requests.some((q) => q.clientId === c.id))! : cl()
      const req = this.request({ at, client, problem: s.problem, urgency: s.urgency, source: s.source, withAi: s.key !== 'missed' })
      byKey[s.key] = req
      emit('request.created', at, `Demande ${req.ref} créée (${problemByCode[s.problem].label})`, req.id, s.source === 'api' ? 'API (n8n)' : 'Standard')
      if (s.source === 'appel_manque') emit('call.missed', at, `Appel manqué de ${client.firstName} ${client.lastName}`, req.callId, 'Twilio')
      else if (s.source === 'appel') emit('call.received', at, `Appel entrant de ${client.firstName} ${client.lastName}`, req.callId, 'Twilio')
    }

    const setStatus = (req: ServiceRequest, status: RequestStatus, at: number, actor = 'Sandrine (secrétariat)') => {
      req.status = status
      req.history.push({ status, at, actor })
      emit('request.status_changed', at, `${req.ref} → ${status.replace('_', ' ')}`, req.id, actor)
    }
    const addrOf = (req: ServiceRequest) => this.ds.clients.find((c) => c.id === req.clientId)!.addresses.find((a) => a.id === req.addressId)!
    const clientOf = (req: ServiceRequest) => this.ds.clients.find((c) => c.id === req.clientId)!

    // 1. Appel manqué : SMS de rappel envoyé, en attente des photos
    const missed = byKey.missed
    missed.photoLinkSentAt = missed.createdAt + 40 * 1000
    missed.ai = undefined
    emit('sms.sent', missed.photoLinkSentAt, `SMS « appel manqué » envoyé à ${clientOf(missed).firstName}`, missed.id, 'Automatisation')

    // 2. Proposition IA en attente de validation, photos et position reçues
    const ai = byKey.ai
    ai.ai!.reviewStatus = 'proposed'
    ai.ai!.confidence = 0.91
    ai.ai!.summary = lyon
      ? 'Porte fermée à double tour, clés perdues dans le métro. Cliente devant sa porte avec un nourrisson, demande une intervention immédiate. Serrure 3 points visible sur la photo, cylindre standard.'
      : 'Chaudière gaz en défaut (code F28 sur la photo), plus de chauffage ni d’eau chaude. Personne âgée dans le logement. Probable problème d’allumage.'
    ai.ai!.suggestedTechnicianId = techs[1].id
    ai.photoLinkSentAt = ai.createdAt + 2 * MINUTE
    ai.media = [this.media(ai, 'client', ai.createdAt + 6 * MINUTE), this.media(ai, 'client', ai.createdAt + 6 * MINUTE), this.media(ai, 'client', ai.createdAt + 7 * MINUTE)]
    ai.locationShared = { at: ai.createdAt + 7 * MINUTE, method: 'gps' }
    emit('request.qualified', ai.ai!.processedAt, `Qualification IA proposée pour ${ai.ref} (confiance 91 %)`, ai.id, 'API (n8n)')
    emit('media.uploaded', ai.createdAt + 6 * MINUTE, `3 photos reçues pour ${ai.ref}`, ai.id, 'Client')
    emit('location.received', ai.createdAt + 7 * MINUTE, `Position GPS partagée pour ${ai.ref}`, ai.id, 'Client')

    // 3. Qualifiée, devis à faire
    const q3 = byKey.qualified
    q3.ai!.reviewStatus = 'accepted'
    setStatus(q3, 'qualifiee', q3.createdAt + 8 * MINUTE)
    q3.media = [this.media(q3, 'client', q3.createdAt + 9 * MINUTE), this.media(q3, 'client', q3.createdAt + 9 * MINUTE)]

    // 4. Devis envoyé et consulté
    const q4 = byKey.quote_viewed
    setStatus(q4, 'qualifiee', q4.createdAt + 6 * MINUTE)
    const quo4 = this.quote(q4, addrOf(q4), q4.createdAt + 20 * MINUTE)
    quo4.viewedAt = quo4.sentAt! + 35 * MINUTE
    quo4.status = 'consulte'
    setStatus(q4, 'devis_envoye', quo4.sentAt!)
    emit('quote.sent', quo4.sentAt!, `Devis ${quo4.ref} envoyé par SMS`, quo4.id, 'Sandrine (secrétariat)')
    emit('quote.viewed', quo4.viewedAt, `Devis ${quo4.ref} consulté par le client`, quo4.id, 'Client')

    // 5. Devis d'hier, relance J+1 envoyée
    const q5 = byKey.quote_old
    setStatus(q5, 'qualifiee', q5.createdAt + 10 * MINUTE)
    const quo5 = this.quote(q5, addrOf(q5), q5.createdAt + 30 * MINUTE)
    quo5.reminders = [quo5.sentAt! + DAY]
    setStatus(q5, 'devis_envoye', quo5.sentAt!)
    this.sms(clientOf(q5), q5.id, quo5.sentAt! + DAY, `${company.shortName} : votre devis ${quo5.ref} est toujours disponible. Consultez-le et signez en ligne : https://urgencepro.example/c/•••`, 'quote_reminder')

    // 6. Devis signé, à planifier
    const q6 = byKey.accepted
    setStatus(q6, 'qualifiee', q6.createdAt + 5 * MINUTE)
    const quo6 = this.quote(q6, addrOf(q6), q6.createdAt + 14 * MINUTE)
    quo6.status = 'signe'
    quo6.viewedAt = quo6.sentAt! + 4 * MINUTE
    quo6.signedAt = now - 20 * MINUTE
    quo6.signerName = `${clientOf(q6).firstName} ${clientOf(q6).lastName}`
    setStatus(q6, 'devis_envoye', quo6.sentAt!)
    setStatus(q6, 'acceptee', quo6.signedAt, 'Client (signature en ligne)')
    emit('quote.signed', quo6.signedAt, `Devis ${quo6.ref} signé par ${quo6.signerName}`, quo6.id, 'Client')
    this.ds.jobs.push({ id: this.id('job'), companyId: company.id, requestId: q6.id, status: 'a_planifier', start: now + 45 * MINUTE, durationMin: problemByCode[q6.problemTypeCode].durationMin })
    q6.jobId = this.ds.jobs[this.ds.jobs.length - 1].id

    const planJob = (req: ServiceRequest, tech: Technician, start: number, status: Job['status']) => {
      const job: Job = { id: this.id('job'), companyId: company.id, requestId: req.id, technicianId: tech.id, status, start, durationMin: problemByCode[req.problemTypeCode].durationMin }
      this.ds.jobs.push(job)
      req.jobId = job.id
      return job
    }

    // 7. Planifiée plus tard dans la journée
    const q7 = byKey.planned
    setStatus(q7, 'qualifiee', q7.createdAt + 4 * MINUTE)
    planJob(q7, techs[2], now + 100 * MINUTE, 'acceptee')
    setStatus(q7, 'planifiee', q7.createdAt + 12 * MINUTE)
    emit('job.scheduled', q7.createdAt + 12 * MINUTE, `${q7.ref} planifiée avec ${techs[2].firstName}`, q7.jobId, 'Sandrine (secrétariat)')

    // 8. Mission proposée, en attente d'acceptation du technicien
    const q8 = byKey.offered
    setStatus(q8, 'qualifiee', q8.createdAt + 4 * MINUTE)
    planJob(q8, techs[3], now + 50 * MINUTE, 'proposee')
    setStatus(q8, 'planifiee', q8.createdAt + 9 * MINUTE)
    emit('job.assigned', q8.createdAt + 9 * MINUTE, `Mission ${q8.ref} proposée à ${techs[3].firstName}`, q8.jobId, 'Sandrine (secrétariat)')

    // 9. Technicien en route
    const q9 = byKey.en_route
    setStatus(q9, 'qualifiee', q9.createdAt + 3 * MINUTE)
    const j9 = planJob(q9, techs[0], now + 12 * MINUTE, 'en_route')
    j9.enRouteAt = now - 9 * MINUTE
    j9.etaMin = 12
    setStatus(q9, 'planifiee', q9.createdAt + 6 * MINUTE)
    setStatus(q9, 'en_route', j9.enRouteAt, `${techs[0].firstName} ${techs[0].lastName}`)
    const a9 = addrOf(q9)
    techs[0].position = { lat: a9.location.lat + 0.018, lng: a9.location.lng - 0.022 }
    this.sms(clientOf(q9), q9.id, q9.createdAt + 6 * MINUTE, `${company.shortName} : demande prise en charge. Arrivée estimée vers ${new Date(now + 12 * MINUTE).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Tarif annoncé : déplacement 38,50 € TTC + forfait.`, 'confirmation')
    this.sms(clientOf(q9), q9.id, j9.enRouteAt, `${company.shortName} : ${techs[0].firstName} est en route. Suivez son arrivée en direct : https://urgencepro.example/c/•••`, 'en_route')
    this.sms(clientOf(q9), q9.id, j9.enRouteAt + 2 * MINUTE, 'Merci ! Le code de la porte est le ' + (a9.doorCode ?? '4512') + ', 3e étage gauche.', 'reponse', 'entrant')
    emit('technician.en_route', j9.enRouteAt, `${techs[0].firstName} en route vers ${q9.ref}`, j9.id, `${techs[0].firstName} ${techs[0].lastName}`)
    emit('sms.received', j9.enRouteAt + 2 * MINUTE, `Réponse SMS de ${clientOf(q9).firstName}`, q9.id, 'Twilio')

    // 10. Technicien sur place
    const q10 = byKey.on_site
    setStatus(q10, 'qualifiee', q10.createdAt + 4 * MINUTE)
    const j10 = planJob(q10, techs[4 % techs.length], now - 25 * MINUTE, 'sur_place')
    j10.enRouteAt = now - 50 * MINUTE
    j10.arrivedAt = now - 25 * MINUTE
    setStatus(q10, 'planifiee', q10.createdAt + 8 * MINUTE)
    setStatus(q10, 'en_route', j10.enRouteAt, techs[4 % techs.length].firstName)
    setStatus(q10, 'sur_place', j10.arrivedAt, techs[4 % techs.length].firstName)
    techs[4 % techs.length].position = { ...addrOf(q10).location }
    emit('technician.arrived', j10.arrivedAt, `${techs[4 % techs.length].firstName} sur place (${q10.ref})`, j10.id, techs[4 % techs.length].firstName)

    // 11. Terminée, facture à créer
    const q11 = byKey.done
    setStatus(q11, 'qualifiee', q11.createdAt + 4 * MINUTE)
    const t11 = techs[1]
    const j11 = planJob(q11, t11, q11.createdAt + 45 * MINUTE, 'terminee')
    j11.enRouteAt = j11.start - 18 * MINUTE
    j11.arrivedAt = j11.start
    j11.completedAt = now - 40 * MINUTE
    j11.report = { workDone: 'Ouverture réalisée, remplacement du cylindre endommagé.', observations: 'Conseil : prévoir un cylindre haute sécurité.', parts: [{ label: 'Cylindre européen 30/30', quantity: 1 }], durationMin: 48, photos: [], signerName: `${clientOf(q11).firstName} ${clientOf(q11).lastName}` }
    setStatus(q11, 'planifiee', q11.createdAt + 7 * MINUTE)
    setStatus(q11, 'en_route', j11.enRouteAt, t11.firstName)
    setStatus(q11, 'sur_place', j11.arrivedAt, t11.firstName)
    setStatus(q11, 'terminee', j11.completedAt, t11.firstName)
    emit('job.completed', j11.completedAt, `Intervention ${q11.ref} terminée par ${t11.firstName}`, j11.id, t11.firstName)
    t11.position = { lat: addrOf(q11).location.lat + 0.004, lng: addrOf(q11).location.lng + 0.003 }

    // 12. Facturée, paiement en attente
    const q12 = byKey.invoiced
    setStatus(q12, 'qualifiee', q12.createdAt + 5 * MINUTE)
    const t12 = techs[5 % techs.length]
    const j12 = planJob(q12, t12, q12.createdAt + 70 * MINUTE, 'terminee')
    j12.enRouteAt = j12.start - 20 * MINUTE
    j12.arrivedAt = j12.start
    j12.completedAt = j12.start + 55 * MINUTE
    setStatus(q12, 'planifiee', q12.createdAt + 9 * MINUTE)
    setStatus(q12, 'en_route', j12.enRouteAt, t12.firstName)
    setStatus(q12, 'sur_place', j12.arrivedAt, t12.firstName)
    setStatus(q12, 'terminee', j12.completedAt, t12.firstName)
    const inv12 = this.invoice(q12, clientOf(q12), quoteLinesFor({ problemTypeCode: q12.problemTypeCode, urgency: q12.urgency, at: new Date(j12.start), address: addrOf(q12), company }), j12.completedAt + 6 * MINUTE, t12.id)
    setStatus(q12, 'facturee', inv12.issuedAt, t12.firstName)
    emit('invoice.created', inv12.issuedAt, `Facture ${inv12.ref} émise (${(totals(inv12.lines).ttc / 100).toFixed(2).replace('.', ',')} € TTC)`, inv12.id, t12.firstName)

    // Paramétrage intégrations
    this.integrations()
    this.ds.events.sort((a, b) => b.at - a.at)
    for (const e of this.ds.events) this.deliver(e)
  }

  deliver(e: AppEvent) {
    for (const w of this.ds.webhooks) {
      if (!w.active || !w.events.includes(e.type)) continue
      const fail = this.r.chance(0.07)
      this.ds.deliveries.push({ id: this.id('dlv'), endpointId: w.id, eventId: e.id, eventType: e.type, at: e.at + 400, status: fail ? 'echec' : 'succes', httpStatus: fail ? 502 : 200, durationMs: this.r.int(80, 640), attempt: 1 })
    }
  }

  integrations() {
    const c = this.cfg.company
    const now = this.now
    this.ds.webhooks = [
      { id: this.id('whk'), companyId: c.id, url: 'https://n8n.example.com/webhook/agent-qualification', description: 'Agent IA de qualification (n8n)', events: ['call.received', 'call.missed', 'call.ended', 'request.created', 'media.uploaded', 'location.received', 'sms.received'], active: true, secretPreview: 'whsec_••••3f9a' },
      { id: this.id('whk'), companyId: c.id, url: 'https://n8n.example.com/webhook/agent-relances', description: 'Agent IA devis et relances (n8n)', events: ['request.qualified', 'quote.sent', 'quote.viewed', 'quote.signed', 'quote.expired', 'invoice.created', 'invoice.overdue', 'invoice.paid', 'job.completed', 'review.received'], active: true, secretPreview: 'whsec_••••b21c' },
      { id: this.id('whk'), companyId: c.id, url: 'https://n8n.example.com/webhook/suivi-temps-reel', description: 'Tableau de suivi interne', events: ['request.status_changed', 'job.scheduled', 'job.assigned', 'technician.en_route', 'technician.arrived'], active: false, secretPreview: 'whsec_••••77d0' },
    ]
    this.ds.apiKeys = [
      { id: this.id('key'), companyId: c.id, name: 'n8n — production', prefix: 'up_live_8fK2', scopes: ['requests:read', 'requests:write', 'calls:read', 'calls:write', 'quotes:write', 'sms:send', 'ai:write', 'media:read'], lastUsedAt: now - 4 * MINUTE, createdAt: now - 64 * DAY },
      { id: this.id('key'), companyId: c.id, name: 'Export comptable', prefix: 'up_live_Q7tz', scopes: ['invoices:read', 'stats:read'], lastUsedAt: now - 2 * DAY, createdAt: now - 120 * DAY },
    ]
    const n = c.shortName
    this.ds.templates = [
      { key: 'missed_call', name: 'Appel manqué', trigger: 'Appel non décroché (call.missed)', active: true, body: `${n} : nous avons bien reçu votre appel. Décrivez votre problème et envoyez une photo ici : {lien}` },
      { key: 'photo_request', name: 'Demande de photos et localisation', trigger: 'Manuel ou agent IA', active: true, body: `Bonjour {prenom_client}, pour préparer l'intervention, envoyez-nous des photos et votre position : {lien}` },
      { key: 'photo_reminder', name: 'Relance photos', trigger: '15 min sans réponse', active: true, body: `{prenom_client}, nous n'avons pas encore reçu vos photos. Cela nous permet d'annoncer un prix précis : {lien}` },
      { key: 'confirmation', name: 'Confirmation de prise en charge', trigger: 'Intervention planifiée', active: true, body: `${n} : votre demande est prise en charge. {technicien} arrive vers {eta}. Tarif annoncé : {montant}.` },
      { key: 'en_route', name: 'Technicien en route', trigger: 'Bouton « En route »', active: true, body: `${n} : {technicien} est en route, arrivée estimée {eta}. Suivez-le en direct : {lien_suivi}` },
      { key: 'delay', name: 'Alerte retard', trigger: 'ETA dépassé de 10 min', active: true, body: `${n} : {technicien} a un peu de retard. Nouvelle heure d'arrivée : {eta}. Merci de votre patience.` },
      { key: 'quote_sent', name: 'Envoi du devis', trigger: 'Devis envoyé', active: true, body: `${n} : votre devis de {montant} est prêt. Consultez-le et signez en ligne : {lien}` },
      { key: 'quote_reminder', name: 'Relance devis', trigger: 'J+1, J+3, J+7', active: true, body: `${n} : votre devis est toujours disponible. Consultez-le et signez en ligne : {lien}` },
      { key: 'invoice_reminder', name: 'Relance facture', trigger: 'J+7, J+15, J+30 après échéance', active: true, body: `${n} : votre facture de {montant} est en attente de règlement. Payez en ligne : {lien}` },
      { key: 'review_request', name: "Demande d'avis", trigger: '2 h après la fin', active: true, body: `${n} : merci pour votre confiance, {prenom_client}. Votre avis nous aide beaucoup : {lien}` },
      { key: 'maintenance', name: "Rappel d'entretien", trigger: '11 mois après le dernier entretien', active: c.trades.includes('chauffage'), body: `${n} : l'entretien annuel de votre chaudière arrive à échéance. Réservez votre créneau : {lien}` },
    ]
    this.ds.automations = [
      { key: 'missed_call_sms', label: 'SMS automatique après un appel manqué', description: 'Envoie le lien de description et de photos dans la minute.', enabled: true },
      { key: 'photo_reminder', label: 'Relance si aucune photo reçue', description: 'Relance unique après 15 minutes.', enabled: true, detail: '15 min' },
      { key: 'ai_qualification', label: 'Qualification par l’agent IA', description: 'Chaque nouvelle demande est envoyée à l’agent n8n, qui propose une qualification.', enabled: true, ai: true },
      { key: 'auto_apply_ai', label: 'Appliquer la qualification IA sans validation', description: 'Seulement si la confiance est d’au moins 90 %. Sinon, validation humaine.', enabled: false, ai: true, detail: '≥ 90 %' },
      { key: 'auto_send_quote', label: 'Envoi automatique des devis', description: 'Les devis brouillons créés par l’IA partent sans validation humaine.', enabled: false, ai: true },
      { key: 'auto_assign', label: 'Affectation automatique du technicien suggéré', description: 'La mission est proposée directement au technicien le mieux placé.', enabled: false },
      { key: 'en_route_sms', label: 'SMS « technicien en route » avec suivi', description: 'Déclenché par le bouton « En route » de l’application technicien.', enabled: true },
      { key: 'delay_sms', label: 'Alerte retard', description: 'Si l’heure d’arrivée est dépassée de plus de 10 minutes.', enabled: true, detail: '10 min' },
      { key: 'quote_reminders', label: 'Relances des devis non signés', description: 'J+1, J+3 et J+7 après l’envoi.', enabled: true, detail: 'J+1 · J+3 · J+7' },
      { key: 'invoice_reminders', label: 'Relances des factures impayées', description: 'J+7, J+15 et J+30 après l’échéance.', enabled: true, detail: 'J+7 · J+15 · J+30' },
      { key: 'review_request', label: 'Demande d’avis après intervention', description: 'Le même message à tous les clients, avec le lien Google et un formulaire de retour privé.', enabled: true, detail: '2 h après' },
      { key: 'maintenance', label: 'Rappels d’entretien périodique', description: 'SMS de prospection : uniquement avec consentement, en semaine de 8 h à 20 h.', enabled: c.trades.includes('chauffage') },
    ]
  }
}

export function generateAll(now: number): Record<string, Dataset> {
  const out: Record<string, Dataset> = {}
  for (const cfg of CONFIGS) {
    const b = new Builder(cfg, now)
    b.setup()
    b.history()
    b.today()
    b.ds.requests.sort((a, b2) => b2.createdAt - a.createdAt)
    b.ds.calls.sort((a, b2) => b2.at - a.at)
    b.ds.sms.sort((a, b2) => a.at - b2.at)
    out[cfg.company.id] = b.ds
  }
  return out
}

export const COMPANY_IDS = CONFIGS.map((c) => c.company.id)
export { LOST_REASONS }
