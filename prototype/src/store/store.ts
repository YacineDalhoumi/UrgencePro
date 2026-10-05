// Store de démonstration : toute la logique métier simulée (en production : couche services + Supabase).
// Chaque action émet les événements correspondants, qui alimentent le journal et les webhooks simulés.
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { toast } from 'sonner'
import { generateAll, type Dataset } from '@/data/generate'
import { estimatePrice, quoteLinesFor, totals } from '@/data/pricing'
import { problemByCode, TRANSITIONS, REQUEST_STATUS } from '@/data/reference'
import { etaMinutes, distanceKm, suggestTechnicians } from '@/data/scheduling'
import type {
  Address, AiProposal, ApiKey, Client, DocLine, Job, JobReport, Media, PaymentMethod, Quote, RequestStatus, ServiceRequest, Sms, Urgency, ClientType,
} from '@/data/types'
import { DAY, MINUTE, money, timeFr, uid } from '@/lib/utils'

export type Theme = 'system' | 'light' | 'dark'

export interface IncomingCall {
  phone: string
  clientId?: string
  known: boolean
  startedAt: number
  problem: string
}

interface QueuedAction {
  id: string
  label: string
  at: number
  jobId: string
  status: 'en_route' | 'sur_place' | 'terminee'
}

interface State {
  data: Record<string, Dataset>
  companyId: string
  theme: Theme
  incoming: IncomingCall | null
  offline: boolean
  queue: QueuedAction[]
  techId: string | null
}

interface Actions {
  setCompany: (id: string) => void
  setTheme: (t: Theme) => void
  reset: () => void
  // Demandes
  createRequest: (input: { clientId?: string; firstName: string; lastName: string; phone: string; type: ClientType; line1: string; postalCode: string; city: string; problemTypeCode: string; urgency: Urgency; description: string }) => string
  validateAi: (requestId: string, decision: 'accepted' | 'rejected') => void
  updateQualification: (requestId: string, patch: Partial<Pick<ServiceRequest, 'problemTypeCode' | 'urgency' | 'complexity' | 'description'>>) => void
  changeStatus: (requestId: string, status: RequestStatus, reason?: string) => void
  addNote: (requestId: string, text: string) => void
  sendPhotoLink: (requestId: string) => void
  // Client (pages publiques)
  clientUpload: (requestId: string, files: { src: string; caption: string }[]) => void
  clientLocation: (requestId: string, method: 'gps' | 'adresse', extra: { line1?: string; floor?: string; doorCode?: string; intercom?: string; comment?: string }) => void
  // Devis
  createQuote: (requestId: string) => string
  updateQuote: (quoteId: string, patch: Partial<Pick<Quote, 'lines' | 'depositPercent' | 'urgentWaiver' | 'validUntil'>>) => void
  sendQuote: (quoteId: string) => void
  viewQuote: (quoteId: string) => void
  signQuote: (quoteId: string, signerName: string, signature: string, waiver: boolean) => void
  refuseQuote: (quoteId: string) => void
  // Planning / interventions
  assignJob: (requestId: string, technicianId: string, start: number) => void
  unassignJob: (jobId: string) => void
  techRespond: (jobId: string, accept: boolean) => void
  techStatus: (jobId: string, status: 'en_route' | 'sur_place' | 'terminee') => void
  saveReport: (jobId: string, report: JobReport) => void
  setTech: (id: string) => void
  setOffline: (v: boolean) => void
  tick: () => void
  // Facturation
  createInvoice: (requestId: string) => string
  recordPayment: (invoiceId: string, method: PaymentMethod) => void
  // Avis
  submitReview: (requestId: string, rating: number, comment: string) => void
  replyReview: (reviewId: string, reply: string) => void
  // Téléphonie / SMS
  simulateCall: (known: boolean) => void
  answerCall: () => string | null
  missCall: () => string | null
  sendSms: (clientId: string, body: string, requestId?: string) => void
  // Paramètres
  toggleAutomation: (key: string) => void
  toggleTemplate: (key: string) => void
  updateTemplate: (key: string, body: string) => void
  createApiKey: (name: string, scopes: string[]) => string
  revokeApiKey: (id: string) => void
  toggleWebhook: (id: string) => void
  addWebhook: (url: string, description: string, events: string[]) => void
  replayDelivery: (id: string) => void
  testWebhook: (id: string) => void
}

export type Store = State & Actions

const fresh = () => generateAll(Date.now())

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('up-theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

function readCompany(): string {
  try {
    return localStorage.getItem('up-company') ?? 'cmp_lyon'
  } catch {
    return 'cmp_lyon'
  }
}

// ——— Aides internes (opèrent sur le brouillon immer) ———

function emit(ds: Dataset, type: string, summary: string, entityId?: string, actor = 'Système') {
  const e = { id: uid('evt'), companyId: ds.company.id, type, at: Date.now(), summary, entityId, actor }
  ds.events.unshift(e)
  for (const w of ds.webhooks) {
    if (!w.active || !w.events.includes(type)) continue
    const fail = Math.random() < 0.06
    ds.deliveries.unshift({ id: uid('dlv'), endpointId: w.id, eventId: e.id, eventType: type, at: Date.now() + 300, status: fail ? 'echec' : 'succes', httpStatus: fail ? 502 : 200, durationMs: 80 + Math.round(Math.random() * 500), attempt: 1 })
  }
}

const clientOf = (ds: Dataset, req: ServiceRequest) => ds.clients.find((c) => c.id === req.clientId)!
const addressOf = (ds: Dataset, req: ServiceRequest): Address | undefined => clientOf(ds, req)?.addresses.find((a) => a.id === req.addressId)
const reqById = (ds: Dataset, id: string) => ds.requests.find((r) => r.id === id)
const auto = (ds: Dataset, key: string) => ds.automations.find((a) => a.key === key)?.enabled ?? false

function render(ds: Dataset, key: string, vars: Record<string, string>) {
  const t = ds.templates.find((x) => x.key === key)
  if (!t || !t.active) return null
  return t.body.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)
}

function pushSms(ds: Dataset, client: Client, body: string, opts: { requestId?: string; template?: string; by?: Sms['by']; direction?: Sms['direction'] } = {}) {
  if (client.smsOptOut && opts.direction !== 'entrant') {
    toast.warning(`SMS non envoyé : ${client.firstName} ${client.lastName} a répondu STOP.`)
    return
  }
  ds.sms.push({
    id: uid('sms'),
    companyId: ds.company.id,
    clientId: client.id,
    requestId: opts.requestId,
    direction: opts.direction ?? 'sortant',
    body,
    at: Date.now(),
    status: opts.direction === 'entrant' ? 'recu' : 'distribue',
    template: opts.template,
    by: opts.by ?? 'automatisation',
  })
}

function setStatus(ds: Dataset, req: ServiceRequest, status: RequestStatus, actor: string, reason?: string) {
  if (req.status === status) return
  req.status = status
  req.history.push({ status, at: Date.now(), actor, reason })
  emit(ds, 'request.status_changed', `${req.ref} → ${REQUEST_STATUS[status].label}`, req.id, actor)
}

function recompute(ds: Dataset, req: ServiceRequest) {
  req.estimate = estimatePrice({ company: ds.company, problemTypeCode: req.problemTypeCode, complexity: req.complexity, urgency: req.urgency, at: new Date(), address: addressOf(ds, req) })
  req.durationMin = problemByCode[req.problemTypeCode]?.durationMin ?? req.durationMin
}

const vars = (ds: Dataset, req: ServiceRequest, extra: Record<string, string> = {}) => {
  const c = clientOf(ds, req)
  return {
    prenom_client: c.firstName,
    entreprise: ds.company.shortName,
    lien: 'https://urgencepro.example/c/•••',
    lien_suivi: 'https://urgencepro.example/c/•••',
    montant: `${money(req.estimate.minCents)} à ${money(req.estimate.maxCents)} TTC`,
    ...extra,
  }
}

/** Simule la réponse d'un agent IA n8n (webhook entrant) quelques secondes après la création. */
function scheduleAiAgent(requestId: string) {
  setTimeout(() => {
    useStore.setState((s) => {
      const ds = s.data[s.companyId]
      const req = reqById(ds, requestId)
      if (!req || req.ai || !auto(ds, 'ai_qualification')) return
      const pt = problemByCode[req.problemTypeCode]
      const ai: AiProposal = {
        summary: `${pt.label}. Client joint par téléphone, adresse confirmée. ${req.urgency === 'absolue' ? 'Bloqué dehors, intervention immédiate souhaitée.' : 'Souhaite un passage rapide.'}`,
        problemTypeCode: req.problemTypeCode,
        urgency: req.urgency,
        complexity: req.complexity,
        durationMin: pt.durationMin,
        priceMinCents: req.estimate.minCents,
        priceMaxCents: req.estimate.maxCents,
        confidence: 0.88,
        agent: 'n8n · agent-qualification v1.3',
        processedAt: Date.now(),
        reviewStatus: 'proposed',
        suggestedTechnicianId: suggestTechnicians(ds, req)[0]?.tech.id,
      }
      req.ai = ai
      emit(ds, 'request.qualified', `Qualification IA proposée pour ${req.ref} (confiance 88 %)`, req.id, 'API (n8n)')
    })
    toast('Agent IA : qualification proposée', { description: 'Ouvrez la demande pour valider ou corriger.' })
  }, 3500)
}

export const useStore = create<Store>()(
  immer((set, get) => {
    /** Applique une mutation sur le jeu de données de l'entreprise active. */
    const mut = (fn: (ds: Dataset, s: State) => void) =>
      set((s) => {
        fn(s.data[s.companyId], s)
      })

    return {
      data: fresh(),
      companyId: readCompany(),
      theme: readTheme(),
      incoming: null,
      offline: false,
      queue: [],
      techId: null,

      setCompany: (id) => {
        set((s) => {
          s.companyId = id
          s.techId = null
        })
        try {
          localStorage.setItem('up-company', id)
        } catch {
          /* stockage indisponible : sans conséquence */
        }
      },
      setTheme: (t) => {
        set((s) => {
          s.theme = t
        })
        try {
          localStorage.setItem('up-theme', t)
        } catch {
          /* idem */
        }
      },
      reset: () => {
        set((s) => {
          s.data = fresh()
          s.incoming = null
          s.queue = []
          s.offline = false
        })
        toast.success('Démo réinitialisée')
      },

      createRequest: (input) => {
        let id = ''
        mut((ds) => {
          let client = input.clientId ? ds.clients.find((c) => c.id === input.clientId) : undefined
          const center = ds.company.center
          if (!client) {
            client = {
              id: uid('cli'),
              companyId: ds.company.id,
              type: input.type,
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone,
              tags: ['nouveau'],
              addresses: [{ id: uid('adr'), line1: input.line1, postalCode: input.postalCode, city: input.city, housingType: 'appartement', location: { lat: center.lat + (Math.random() - 0.5) * 0.03, lng: center.lng + (Math.random() - 0.5) * 0.04 } }],
              createdAt: Date.now(),
              smsOptOut: false,
            }
            ds.clients.push(client)
          }
          const address = client.addresses[0]
          const pt = problemByCode[input.problemTypeCode]
          const year = new Date().getFullYear()
          const req: ServiceRequest = {
            id: uid('req'),
            companyId: ds.company.id,
            ref: `DEM-${year}-${String(++ds.counters.request).padStart(5, '0')}`,
            clientId: client.id,
            addressId: address.id,
            source: 'manuel',
            trade: pt.trade,
            problemTypeCode: input.problemTypeCode,
            urgency: input.urgency,
            description: input.description || pt.label,
            complexity: pt.complexity,
            durationMin: pt.durationMin,
            estimate: estimatePrice({ company: ds.company, problemTypeCode: input.problemTypeCode, complexity: pt.complexity, urgency: input.urgency, at: new Date(), address }),
            status: 'nouvelle',
            history: [{ status: 'nouvelle', at: Date.now(), actor: 'Sandrine (secrétariat)' }],
            createdAt: Date.now(),
            media: [],
            notes: [],
          }
          ds.requests.unshift(req)
          id = req.id
          emit(ds, 'request.created', `Demande ${req.ref} créée (${pt.label})`, req.id, 'Sandrine (secrétariat)')
        })
        scheduleAiAgent(id)
        toast.success('Demande créée', { description: 'L’agent IA va proposer une qualification.' })
        return id
      },

      validateAi: (requestId, decision) =>
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req?.ai) return
          req.ai.reviewStatus = decision
          if (decision === 'accepted') {
            req.problemTypeCode = req.ai.problemTypeCode
            req.urgency = req.ai.urgency
            req.complexity = req.ai.complexity
            recompute(ds, req)
            if (req.status === 'nouvelle') setStatus(ds, req, 'qualifiee', 'Sandrine (secrétariat)')
            toast.success('Qualification IA validée')
          } else {
            toast('Proposition IA rejetée', { description: 'La qualification reste manuelle.' })
          }
        }),

      updateQualification: (requestId, patch) =>
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req) return
          Object.assign(req, patch)
          if (patch.problemTypeCode) req.trade = problemByCode[patch.problemTypeCode].trade
          recompute(ds, req)
          if (req.ai?.reviewStatus === 'proposed') req.ai.reviewStatus = 'edited'
        }),

      changeStatus: (requestId, status, reason) =>
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req) return
          if (!TRANSITIONS[req.status].includes(status)) {
            toast.error(`Transition impossible : ${REQUEST_STATUS[req.status].label} → ${REQUEST_STATUS[status].label}`)
            return
          }
          if (status === 'perdue') req.lostReason = reason
          setStatus(ds, req, status, 'Sandrine (secrétariat)', reason)
          toast.success(`Statut : ${REQUEST_STATUS[status].label}`)
        }),

      addNote: (requestId, text) =>
        mut((ds) => {
          reqById(ds, requestId)?.notes.push({ at: Date.now(), author: 'Sandrine (secrétariat)', text })
        }),

      sendPhotoLink: (requestId) =>
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req) return
          const body = render(ds, 'photo_request', vars(ds, req))
          if (!body) return
          pushSms(ds, clientOf(ds, req), body, { requestId, template: 'photo_request', by: 'utilisateur' })
          req.photoLinkSentAt = Date.now()
          emit(ds, 'sms.sent', `Lien photos et localisation envoyé (${req.ref})`, req.id, 'Sandrine (secrétariat)')
          toast.success('SMS envoyé', { description: 'Le lien expire dans 48 h. Ouvrez « Parcours client » pour jouer le rôle du client.' })
        }),

      clientUpload: (requestId, files) =>
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req) return
          for (const f of files) {
            const m: Media = { id: uid('med'), requestId, kind: 'photo', category: 'client', caption: f.caption, src: f.src, at: Date.now() }
            req.media.push(m)
          }
          emit(ds, 'media.uploaded', `${files.length} photo${files.length > 1 ? 's' : ''} reçue${files.length > 1 ? 's' : ''} pour ${req.ref}`, req.id, 'Client')
          toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} reçue${files.length > 1 ? 's' : ''}`, { description: `Ajoutée${files.length > 1 ? 's' : ''} à la demande ${req.ref}.` })
        }),

      clientLocation: (requestId, method, extra) =>
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req) return
          const a = addressOf(ds, req)
          if (a) {
            if (extra.line1) a.line1 = extra.line1
            if (extra.floor) a.floor = extra.floor
            if (extra.doorCode) a.doorCode = extra.doorCode
            if (extra.intercom) a.intercom = extra.intercom
            if (extra.comment) a.accessNotes = extra.comment
          }
          req.locationShared = { at: Date.now(), method }
          emit(ds, 'location.received', `${method === 'gps' ? 'Position GPS' : 'Adresse'} reçue pour ${req.ref}`, req.id, 'Client')
        }),

      createQuote: (requestId) => {
        let id = ''
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req) return
          if (req.quoteId) {
            id = req.quoteId
            return
          }
          const q: Quote = {
            id: uid('quo'),
            companyId: ds.company.id,
            ref: `DEV-${new Date().getFullYear()}-${String(++ds.counters.quote).padStart(5, '0')}`,
            requestId,
            clientId: req.clientId,
            status: 'brouillon',
            lines: quoteLinesFor({ problemTypeCode: req.problemTypeCode, urgency: req.urgency, at: new Date(), address: addressOf(ds, req), company: ds.company, includeOptional: req.complexity >= 3 }),
            createdAt: Date.now(),
            validUntil: Date.now() + 30 * DAY,
            depositPercent: req.urgency === 'planifiee' ? 30 : 0,
            urgentWaiver: req.urgency !== 'planifiee',
            aiDraft: false,
            reminders: [],
          }
          ds.quotes.unshift(q)
          req.quoteId = q.id
          id = q.id
          emit(ds, 'quote.created', `Devis ${q.ref} créé (brouillon)`, q.id, 'Sandrine (secrétariat)')
        })
        return id
      },

      updateQuote: (quoteId, patch) =>
        mut((ds) => {
          const q = ds.quotes.find((x) => x.id === quoteId)
          if (q) Object.assign(q, patch)
        }),

      sendQuote: (quoteId) =>
        mut((ds) => {
          const q = ds.quotes.find((x) => x.id === quoteId)
          if (!q) return
          const req = reqById(ds, q.requestId)!
          q.status = 'envoye'
          q.sentAt = Date.now()
          if (req.status === 'nouvelle') setStatus(ds, req, 'qualifiee', 'Sandrine (secrétariat)')
          setStatus(ds, req, 'devis_envoye', 'Sandrine (secrétariat)')
          const body = render(ds, 'quote_sent', vars(ds, req, { montant: money(totals(q.lines).ttc) + ' TTC' }))
          if (body) pushSms(ds, clientOf(ds, req), body, { requestId: req.id, template: 'quote_sent', by: 'utilisateur' })
          emit(ds, 'quote.sent', `Devis ${q.ref} envoyé par SMS`, q.id, 'Sandrine (secrétariat)')
          toast.success('Devis envoyé par SMS', { description: 'Relances prévues à J+1, J+3 et J+7 s’il n’est pas signé.' })
        }),

      viewQuote: (quoteId) =>
        mut((ds) => {
          const q = ds.quotes.find((x) => x.id === quoteId)
          if (!q || q.viewedAt || q.status !== 'envoye') return
          q.status = 'consulte'
          q.viewedAt = Date.now()
          emit(ds, 'quote.viewed', `Devis ${q.ref} consulté par le client`, q.id, 'Client')
        }),

      signQuote: (quoteId, signerName, signature, waiver) =>
        mut((ds) => {
          const q = ds.quotes.find((x) => x.id === quoteId)
          if (!q) return
          const req = reqById(ds, q.requestId)!
          q.status = 'signe'
          q.signedAt = Date.now()
          q.signerName = signerName
          q.signature = signature
          q.urgentWaiver = waiver
          if (['nouvelle', 'qualifiee', 'devis_envoye'].includes(req.status)) setStatus(ds, req, 'acceptee', 'Client (signature)')
          if (!req.jobId) {
            const job: Job = { id: uid('job'), companyId: ds.company.id, requestId: req.id, status: 'a_planifier', start: Date.now() + 45 * MINUTE, durationMin: req.durationMin }
            ds.jobs.push(job)
            req.jobId = job.id
          }
          emit(ds, 'quote.signed', `Devis ${q.ref} signé par ${signerName}`, q.id, 'Client')
          toast.success(`Devis ${q.ref} signé`, { description: `Signé par ${signerName} à ${timeFr(Date.now())}. Intervention à planifier.` })
        }),

      refuseQuote: (quoteId) =>
        mut((ds) => {
          const q = ds.quotes.find((x) => x.id === quoteId)
          if (!q) return
          q.status = 'refuse'
          const req = reqById(ds, q.requestId)!
          req.lostReason = 'Devis refusé'
          setStatus(ds, req, 'perdue', 'Client', 'Devis refusé')
        }),

      assignJob: (requestId, technicianId, start) =>
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req) return
          const tech = ds.technicians.find((t) => t.id === technicianId)!
          let job = req.jobId ? ds.jobs.find((j) => j.id === req.jobId) : undefined
          if (!job) {
            job = { id: uid('job'), companyId: ds.company.id, requestId, status: 'a_planifier', start, durationMin: req.durationMin }
            ds.jobs.push(job)
            req.jobId = job.id
          }
          const reassigned = job.technicianId && job.technicianId !== technicianId
          job.technicianId = technicianId
          job.start = start
          if (['a_planifier', 'proposee', 'acceptee'].includes(job.status)) job.status = 'proposee'
          if (['qualifiee', 'acceptee', 'nouvelle'].includes(req.status)) {
            if (req.status === 'nouvelle') setStatus(ds, req, 'qualifiee', 'Sandrine (secrétariat)')
            setStatus(ds, req, 'planifiee', 'Sandrine (secrétariat)')
            const body = render(ds, 'confirmation', vars(ds, req, { technicien: tech.firstName, eta: timeFr(start) }))
            if (body) pushSms(ds, clientOf(ds, req), body, { requestId, template: 'confirmation' })
          }
          emit(ds, 'job.scheduled', `${req.ref} planifiée à ${timeFr(start)}`, job.id, 'Sandrine (secrétariat)')
          emit(ds, 'job.assigned', `Mission ${req.ref} proposée à ${tech.firstName}`, job.id, 'Sandrine (secrétariat)')
          toast.success(`${reassigned ? 'Réaffectée' : 'Proposée'} à ${tech.firstName} ${tech.lastName}`, { description: `Notification envoyée sur son téléphone (${timeFr(start)}).` })
        }),

      unassignJob: (jobId) =>
        mut((ds) => {
          const job = ds.jobs.find((j) => j.id === jobId)
          if (!job) return
          job.technicianId = undefined
          job.status = 'a_planifier'
        }),

      techRespond: (jobId, accept) =>
        mut((ds) => {
          const job = ds.jobs.find((j) => j.id === jobId)
          if (!job) return
          const tech = ds.technicians.find((t) => t.id === job.technicianId)
          const req = reqById(ds, job.requestId)!
          if (accept) {
            job.status = 'acceptee'
            emit(ds, 'job.assigned', `${tech?.firstName} a accepté la mission ${req.ref}`, job.id, tech?.firstName)
            toast.success('Mission acceptée')
          } else {
            job.status = 'a_planifier'
            job.technicianId = undefined
            emit(ds, 'job.offer_refused', `${tech?.firstName} a refusé la mission ${req.ref}`, job.id, tech?.firstName)
            toast('Mission refusée', { description: 'Elle repart dans la file « À planifier » du dispatcher.' })
          }
        }),

      techStatus: (jobId, status) => {
        const s = get()
        if (s.offline) {
          set((st) => {
            st.queue.push({ id: uid('q'), label: status === 'en_route' ? 'En route' : status === 'sur_place' ? 'Sur place' : 'Terminé', at: Date.now(), jobId, status })
            const job = st.data[st.companyId].jobs.find((j) => j.id === jobId)
            if (job) job.status = status // affichage local optimiste
          })
          toast('Hors connexion : action enregistrée', { description: 'Elle sera synchronisée dès le retour du réseau.' })
          return
        }
        applyTechStatus(jobId, status)
      },

      saveReport: (jobId, report) =>
        mut((ds) => {
          const job = ds.jobs.find((j) => j.id === jobId)
          if (!job) return
          job.report = report
          const req = reqById(ds, job.requestId)
          if (req) req.media.push(...report.photos)
          // Décrémente le stock du véhicule
          for (const p of report.parts) {
            const line = ds.stock.find((st) => st.technicianId === job.technicianId && p.label.startsWith(labelOf(st.code)))
            if (line) line.qty = Math.max(0, line.qty - p.quantity)
          }
          toast.success('Rapport enregistré')
        }),

      setTech: (id) =>
        set((s) => {
          s.techId = id
        }),

      setOffline: (v) => {
        set((s) => {
          s.offline = v
        })
        if (!v) {
          const q = get().queue
          if (q.length) {
            for (const a of q) applyTechStatus(a.jobId, a.status, true)
            set((s) => {
              s.queue = []
            })
            toast.success(`${q.length} action${q.length > 1 ? 's' : ''} synchronisée${q.length > 1 ? 's' : ''}`)
          }
        }
      },

      tick: () =>
        set((s) => {
          const ds = s.data[s.companyId]
          for (const job of ds.jobs) {
            if (job.status !== 'en_route' || !job.technicianId) continue
            const tech = ds.technicians.find((t) => t.id === job.technicianId)
            const req = reqById(ds, job.requestId)
            const addr = req && addressOf(ds, req)
            if (!tech || !addr) continue
            const d = distanceKm(tech.position, addr.location)
            if (d < 0.08) continue
            const step = Math.min(1, 0.22 / d)
            tech.position = { lat: tech.position.lat + (addr.location.lat - tech.position.lat) * step, lng: tech.position.lng + (addr.location.lng - tech.position.lng) * step }
            job.etaMin = etaMinutes(tech.position, addr.location)
          }
        }),

      createInvoice: (requestId) => {
        let id = ''
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req) return
          if (req.invoiceId) {
            id = req.invoiceId
            return
          }
          const q = req.quoteId ? ds.quotes.find((x) => x.id === req.quoteId) : undefined
          const job = req.jobId ? ds.jobs.find((j) => j.id === req.jobId) : undefined
          const lines: DocLine[] = q?.status === 'signe'
            ? q.lines.map((l) => ({ ...l, id: uid('l') }))
            : quoteLinesFor({ problemTypeCode: req.problemTypeCode, urgency: req.urgency, at: new Date(job?.start ?? Date.now()), address: addressOf(ds, req), company: ds.company })
          const client = clientOf(ds, req)
          const inv = {
            id: uid('inv'),
            companyId: ds.company.id,
            ref: `FAC-${new Date().getFullYear()}-${String(++ds.counters.invoice).padStart(6, '0')}`,
            requestId,
            clientId: req.clientId,
            technicianId: job?.technicianId,
            kind: 'facture' as const,
            status: 'emise' as const,
            lines,
            issuedAt: Date.now(),
            dueAt: Date.now() + (client.type === 'particulier' ? 15 : 30) * DAY,
            payments: [],
          }
          ds.invoices.unshift(inv)
          req.invoiceId = inv.id
          id = inv.id
          if (req.status === 'terminee') setStatus(ds, req, 'facturee', 'Sandrine (secrétariat)')
          emit(ds, 'invoice.created', `Facture ${inv.ref} émise (${money(totals(lines).ttc)} TTC)`, inv.id, 'Sandrine (secrétariat)')
          toast.success(`Facture ${inv.ref} émise`, { description: 'Numérotation continue, document verrouillé.' })
        })
        return id
      },

      recordPayment: (invoiceId, method) =>
        mut((ds) => {
          const inv = ds.invoices.find((i) => i.id === invoiceId)
          if (!inv) return
          const due = totals(inv.lines).ttc - inv.payments.reduce((a, p) => a + p.amountCents, 0)
          if (due <= 0) return
          inv.payments.push({ id: uid('pay'), amountCents: due, method, at: Date.now() })
          inv.status = 'payee'
          const req = reqById(ds, inv.requestId)
          if (req && req.status === 'facturee') setStatus(ds, req, 'payee', method === 'cb_en_ligne' ? 'Stripe' : 'Technicien')
          emit(ds, 'invoice.paid', `Facture ${inv.ref} payée (${money(due)})`, inv.id, method === 'cb_en_ligne' ? 'Stripe' : 'Technicien')
          toast.success(`Paiement de ${money(due)} enregistré`)
          if (req && auto(ds, 'review_request')) {
            const body = render(ds, 'review_request', vars(ds, req))
            if (body) pushSms(ds, clientOf(ds, req), body, { requestId: req.id, template: 'review_request' })
          }
        }),

      submitReview: (requestId, rating, comment) =>
        mut((ds) => {
          const req = reqById(ds, requestId)
          if (!req) return
          const c = clientOf(ds, req)
          const job = req.jobId ? ds.jobs.find((j) => j.id === req.jobId) : undefined
          const r = { id: uid('rev'), companyId: ds.company.id, requestId, clientId: c.id, technicianId: job?.technicianId, source: 'interne' as const, rating, comment, author: `${c.firstName} ${c.lastName[0]}.`, at: Date.now() }
          ds.reviews.unshift(r)
          req.reviewId = r.id
          emit(ds, 'review.received', `Avis ${rating}/5 reçu de ${r.author}`, r.id, 'Client')
          if (rating <= 3) toast.warning(`Avis ${rating}/5 reçu`, { description: 'Alerte envoyée au gérant pour rappeler le client.' })
          else toast.success(`Avis ${rating}/5 reçu`)
        }),

      replyReview: (reviewId, reply) =>
        mut((ds) => {
          const r = ds.reviews.find((x) => x.id === reviewId)
          if (r) r.reply = reply
        }),

      simulateCall: (known) =>
        set((s) => {
          const ds = s.data[s.companyId]
          const regulars = ds.clients.filter((c) => c.type === 'particulier' && ds.requests.filter((r) => r.clientId === c.id).length >= 2)
          const c = known ? regulars[Math.floor(Math.random() * regulars.length)] : undefined
          const problems = ds.company.trades.includes('serrurerie') ? ['porte_claquee', 'porte_fermee', 'cle_cassee'] : ['fuite_eau', 'wc_bouche', 'chauffe_eau']
          s.incoming = {
            phone: c?.phone ?? `+3363998${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
            clientId: c?.id,
            known: !!c,
            startedAt: Date.now(),
            problem: problems[Math.floor(Math.random() * problems.length)],
          }
        }),

      answerCall: () => callOutcome(false),
      missCall: () => callOutcome(true),

      sendSms: (clientId, body, requestId) => {
        mut((ds) => {
          const c = ds.clients.find((x) => x.id === clientId)
          if (c) pushSms(ds, c, body, { requestId, by: 'utilisateur' })
        })
        toast.success('SMS envoyé')
        // Le client répond quelques secondes plus tard (simulation Twilio entrant)
        setTimeout(() => {
          mut((ds) => {
            const c = ds.clients.find((x) => x.id === clientId)
            if (!c || c.smsOptOut) return
            pushSms(ds, c, 'D’accord, merci beaucoup. Je reste disponible sur ce numéro.', { requestId, direction: 'entrant', by: 'client' })
            emit(ds, 'sms.received', `Réponse SMS de ${c.firstName} ${c.lastName}`, requestId, 'Twilio')
          })
          toast('Nouveau SMS reçu', { description: 'Le client a répondu.' })
        }, 5000)
      },

      toggleAutomation: (key) =>
        mut((ds) => {
          const a = ds.automations.find((x) => x.key === key)
          if (a) a.enabled = !a.enabled
        }),
      toggleTemplate: (key) =>
        mut((ds) => {
          const t = ds.templates.find((x) => x.key === key)
          if (t) t.active = !t.active
        }),
      updateTemplate: (key, body) =>
        mut((ds) => {
          const t = ds.templates.find((x) => x.key === key)
          if (t) t.body = body
        }),

      createApiKey: (name, scopes) => {
        const secret = `up_live_${Array.from({ length: 32 }, () => 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 57)]).join('')}`
        mut((ds) => {
          const k: ApiKey = { id: uid('key'), companyId: ds.company.id, name, prefix: secret.slice(0, 12), scopes, createdAt: Date.now() }
          ds.apiKeys.unshift(k)
        })
        return secret
      },
      revokeApiKey: (id) =>
        mut((ds) => {
          ds.apiKeys = ds.apiKeys.filter((k) => k.id !== id)
          toast.success('Clé révoquée')
        }),
      toggleWebhook: (id) =>
        mut((ds) => {
          const w = ds.webhooks.find((x) => x.id === id)
          if (w) w.active = !w.active
        }),
      addWebhook: (url, description, events) =>
        mut((ds) => {
          ds.webhooks.push({ id: uid('whk'), companyId: ds.company.id, url, description, events, active: true, secretPreview: `whsec_••••${Math.random().toString(16).slice(2, 6)}` })
          toast.success('Webhook ajouté', { description: 'Le secret de signature HMAC est affiché une seule fois.' })
        }),
      replayDelivery: (id) =>
        mut((ds) => {
          const d = ds.deliveries.find((x) => x.id === id)
          if (!d) return
          ds.deliveries.unshift({ ...d, id: uid('dlv'), at: Date.now(), status: 'succes', httpStatus: 200, durationMs: 140 + Math.round(Math.random() * 200), attempt: d.attempt + 1 })
          toast.success('Événement renvoyé', { description: 'Réponse 200 OK.' })
        }),
      testWebhook: (id) =>
        mut((ds) => {
          const w = ds.webhooks.find((x) => x.id === id)
          if (!w) return
          ds.deliveries.unshift({ id: uid('dlv'), endpointId: id, eventId: uid('evt'), eventType: 'ping', at: Date.now(), status: 'succes', httpStatus: 200, durationMs: 120, attempt: 1 })
          toast.success('Événement de test envoyé', { description: `${w.url} a répondu 200 OK.` })
        }),
    }
  }),
)

function labelOf(code: string) {
  return code === 'CYL-STD' ? 'Cylindre européen' : code
}

/** Changement de statut d'une mission par le technicien → statut de la demande, SMS, événements. */
function applyTechStatus(jobId: string, status: 'en_route' | 'sur_place' | 'terminee', fromQueue = false) {
  useStore.setState((s) => {
    const ds = s.data[s.companyId]
    const job = ds.jobs.find((j) => j.id === jobId)
    if (!job) return
    const tech = ds.technicians.find((t) => t.id === job.technicianId)
    const req = reqById(ds, job.requestId)!
    const who = tech ? `${tech.firstName} ${tech.lastName}` : 'Technicien'
    const addr = addressOf(ds, req)
    if (status === 'en_route') {
      job.status = 'en_route'
      job.enRouteAt = Date.now()
      job.etaMin = tech && addr ? etaMinutes(tech.position, addr.location) : 15
      if (req.status === 'acceptee' || req.status === 'qualifiee') setStatus(ds, req, 'planifiee', who)
      setStatus(ds, req, 'en_route', who)
      emit(ds, 'technician.en_route', `${tech?.firstName} en route vers ${req.ref} (ETA ${job.etaMin} min)`, job.id, who)
      if (auto(ds, 'en_route_sms')) {
        const body = render(ds, 'en_route', vars(ds, req, { technicien: tech?.firstName ?? '', eta: timeFr(Date.now() + job.etaMin * MINUTE) }))
        if (body) pushSms(ds, clientOf(ds, req), body, { requestId: req.id, template: 'en_route' })
      }
    } else if (status === 'sur_place') {
      job.status = 'sur_place'
      job.arrivedAt = Date.now()
      if (tech && addr) tech.position = { ...addr.location }
      setStatus(ds, req, 'sur_place', who)
      emit(ds, 'technician.arrived', `${tech?.firstName} est arrivé (${req.ref})`, job.id, who)
    } else {
      job.status = 'terminee'
      job.completedAt = Date.now()
      setStatus(ds, req, 'terminee', who)
      emit(ds, 'job.completed', `Intervention ${req.ref} terminée`, job.id, who)
    }
  })
  if (!fromQueue) {
    const msg = { en_route: 'Statut « En route » envoyé', sur_place: 'Statut « Sur place » envoyé', terminee: 'Intervention terminée' }[status]
    toast.success(msg, { description: status === 'en_route' ? 'Le client reçoit un SMS avec le lien de suivi.' : undefined })
  }
}

/** Fin de la sonnerie : appel décroché ou manqué → création de la demande. */
function callOutcome(missed: boolean): string | null {
  const s = useStore.getState()
  const inc = s.incoming
  if (!inc) return null
  let requestId = ''
  useStore.setState((st) => {
    const ds = st.data[st.companyId]
    let client = inc.clientId ? ds.clients.find((c) => c.id === inc.clientId) : undefined
    if (!client) {
      const center = ds.company.center
      client = {
        id: uid('cli'),
        companyId: ds.company.id,
        type: 'particulier',
        firstName: 'Nouveau',
        lastName: 'client',
        phone: inc.phone,
        tags: ['nouveau'],
        addresses: [{ id: uid('adr'), line1: 'Adresse à confirmer', postalCode: ds.company.postalCodes[1], city: ds.company.city, housingType: 'appartement', location: { lat: center.lat + 0.01, lng: center.lng - 0.012 } }],
        createdAt: Date.now(),
        smsOptOut: false,
      }
      ds.clients.push(client)
    }
    const pt = problemByCode[inc.problem]
    const address = client.addresses[0]
    const req: ServiceRequest = {
      id: uid('req'),
      companyId: ds.company.id,
      ref: `DEM-${new Date().getFullYear()}-${String(++ds.counters.request).padStart(5, '0')}`,
      clientId: client.id,
      addressId: address.id,
      source: missed ? 'appel_manque' : 'appel',
      trade: pt.trade,
      problemTypeCode: inc.problem,
      urgency: 'absolue',
      description: missed ? 'Appel manqué — en attente de la description du client.' : `${pt.label}. Client au téléphone.`,
      complexity: pt.complexity,
      durationMin: pt.durationMin,
      estimate: estimatePrice({ company: ds.company, problemTypeCode: inc.problem, complexity: pt.complexity, urgency: 'absolue', at: new Date(), address }),
      status: 'nouvelle',
      history: [{ status: 'nouvelle', at: Date.now(), actor: 'Standard' }],
      createdAt: Date.now(),
      media: [],
      notes: [],
    }
    const callId = uid('call')
    ds.calls.unshift({
      id: callId,
      companyId: ds.company.id,
      from: inc.phone,
      clientId: client.id,
      requestId: req.id,
      status: missed ? 'manque' : 'repondu',
      at: inc.startedAt,
      durationSec: missed ? 0 : 95,
      waitSec: Math.round((Date.now() - inc.startedAt) / 1000),
      answeredBy: missed ? undefined : 'Sandrine (secrétariat)',
      recording: !missed,
      missedSmsSent: missed,
    })
    req.callId = callId
    ds.requests.unshift(req)
    requestId = req.id
    emit(ds, missed ? 'call.missed' : 'call.received', `${missed ? 'Appel manqué' : 'Appel entrant'} de ${client.firstName} ${client.lastName}`, callId, 'Twilio')
    emit(ds, 'request.created', `Demande ${req.ref} créée automatiquement`, req.id, 'Standard')
    if (missed && auto(ds, 'missed_call_sms')) {
      const body = render(ds, 'missed_call', vars(ds, req))
      if (body) {
        pushSms(ds, client, body, { requestId: req.id, template: 'missed_call' })
        req.photoLinkSentAt = Date.now()
      }
    }
    st.incoming = null
  })
  if (missed) toast('Appel manqué', { description: 'SMS de rappel envoyé automatiquement avec le lien photos.' })
  scheduleAiAgent(requestId)
  return requestId
}
