// Calcul des indicateurs du tableau de bord (en production : vues SQL matérialisées + endpoint /v1/stats).
import type { Dataset } from '@/data/generate'
import { totals } from '@/data/pricing'
import { problemByCode } from '@/data/reference'
import { DAY } from './utils'

export interface Period {
  from: number
  to: number
}

export type PeriodKey = 'jour' | '7j' | '30j' | 'mois' | 'annee' | 'perso'

export function periodFor(key: PeriodKey, now = Date.now(), custom?: Period): { cur: Period; prev: Period; label: string } {
  const d0 = new Date(now)
  d0.setHours(0, 0, 0, 0)
  let cur: Period
  let label: string
  switch (key) {
    case 'jour':
      cur = { from: d0.getTime(), to: now }
      label = 'hier à la même heure'
      return { cur, prev: { from: cur.from - DAY, to: cur.to - DAY }, label }
    case '7j':
      cur = { from: now - 7 * DAY, to: now }
      label = 'les 7 jours précédents'
      break
    case '30j':
      cur = { from: now - 30 * DAY, to: now }
      label = 'les 30 jours précédents'
      break
    case 'mois': {
      const m = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime()
      cur = { from: m, to: now }
      const pm = new Date(d0.getFullYear(), d0.getMonth() - 1, 1).getTime()
      label = 'le mois précédent à date'
      return { cur, prev: { from: pm, to: pm + (now - m) }, label }
    }
    case 'annee': {
      // L'historique de démo couvre 6 mois : « année » = depuis le 1er janvier
      const y = new Date(d0.getFullYear(), 0, 1).getTime()
      cur = { from: y, to: now }
      label = 'la même période N-1'
      return { cur, prev: { from: y - 365 * DAY, to: now - 365 * DAY }, label }
    }
    case 'perso':
      cur = custom ?? { from: now - 30 * DAY, to: now }
      label = 'la période précédente de même durée'
      break
  }
  const len = cur.to - cur.from
  return { cur, prev: { from: cur.from - len, to: cur.from }, label }
}

const inP = (t: number | undefined, p: Period) => t !== undefined && t >= p.from && t < p.to

export function kpis(ds: Dataset, p: Period) {
  const invoices = ds.invoices.filter((i) => inP(i.issuedAt, p) && i.kind === 'facture')
  const revenueHt = invoices.reduce((a, i) => a + totals(i.lines).ht, 0)
  const jobs = ds.jobs.filter((j) => j.status === 'terminee' && inP(j.completedAt, p))
  const requests = ds.requests.filter((r) => inP(r.createdAt, p))
  const clientIds = new Set(requests.map((r) => r.clientId))
  const firstRequest = new Map<string, number>()
  for (const r of ds.requests) {
    const f = firstRequest.get(r.clientId)
    if (f === undefined || r.createdAt < f) firstRequest.set(r.clientId, r.createdAt)
  }
  let newClients = 0
  let returning = 0
  for (const id of clientIds) {
    if ((firstRequest.get(id) ?? 0) >= p.from) newClients++
    else returning++
  }
  const calls = ds.calls.filter((c) => inP(c.at, p))
  const missed = calls.filter((c) => c.status === 'manque' || c.status === 'messagerie').length
  const aiHandled = calls.filter((c) => c.status === 'agent_ia').length
  const answered = calls.filter((c) => c.status === 'repondu')
  const avgWait = answered.length ? answered.reduce((a, c) => a + c.waitSec, 0) / answered.length : 0

  const reqById = new Map(ds.requests.map((r) => [r.id, r]))
  const arrivals = jobs
    .map((j) => {
      const r = reqById.get(j.requestId)
      return r && j.arrivedAt && (r.urgency === 'absolue' || r.urgency === 'moins_2h') ? (j.arrivedAt - r.createdAt) / 60000 : null
    })
    .filter((x): x is number => x !== null && x > 0 && x < 600)
  const avgArrival = arrivals.length ? arrivals.reduce((a, b) => a + b, 0) / arrivals.length : 0

  // Entonnoir de conversion (sur les demandes créées dans la période)
  const quoted = requests.filter((r) => r.quoteId)
  const intervened = requests.filter((r) => r.history.some((h) => h.status === 'terminee'))
  const paid = requests.filter((r) => r.history.some((h) => h.status === 'payee'))
  const funnel = [
    { stage: 'Appels et contacts', value: calls.length + requests.filter((r) => r.source !== 'appel' && r.source !== 'appel_manque').length },
    { stage: 'Demandes', value: requests.length },
    { stage: 'Devis ou prix annoncé', value: requests.filter((r) => r.status !== 'nouvelle' && !(r.status === 'perdue' && !r.quoteId && r.history.length <= 3)).length },
    { stage: 'Interventions', value: intervened.length },
    { stage: 'Payées', value: paid.length },
  ]

  const quotes = ds.quotes.filter((q) => inP(q.sentAt, p))
  const decided = quotes.filter((q) => ['signe', 'refuse', 'expire'].includes(q.status))
  const acceptance = decided.length ? decided.filter((q) => q.status === 'signe').length / decided.length : 0
  const pendingQuotes = ds.quotes.filter((q) => q.status === 'envoye' || q.status === 'consulte')
  const pendingQuotesAmount = pendingQuotes.reduce((a, q) => a + totals(q.lines).ttc, 0)
  const unpaid = ds.invoices.filter((i) => i.status === 'emise' || i.status === 'en_retard' || i.status === 'partielle')
  const unpaidAmount = unpaid.reduce((a, i) => a + totals(i.lines).ttc - i.payments.reduce((x, y) => x + y.amountCents, 0), 0)
  const overdue = unpaid.filter((i) => i.status === 'en_retard')

  const reviews = ds.reviews.filter((r) => inP(r.at, p))
  const google = reviews.filter((r) => r.source === 'google')
  const avgRating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0

  return {
    revenueHt,
    jobs: jobs.length,
    avgBasket: invoices.length ? revenueHt / invoices.length : 0,
    invoices: invoices.length,
    newClients,
    returning,
    calls: calls.length,
    missed,
    aiHandled,
    avgWait,
    avgArrival,
    funnel,
    quotesSent: quotes.length,
    quoted: quoted.length,
    acceptance,
    pendingQuotes: pendingQuotes.length,
    pendingQuotesAmount,
    unpaid: unpaid.length,
    unpaidAmount,
    overdue: overdue.length,
    googleNew: google.length,
    avgRating,
    reviews: reviews.length,
  }
}

export function revenueSeries(ds: Dataset, p: Period, prev: Period) {
  const len = p.to - p.from
  const bucket = len <= 2 * DAY ? 3600_000 : len <= 62 * DAY ? DAY : 7 * DAY
  const n = Math.max(1, Math.ceil(len / bucket))
  const cur = new Array(n).fill(0)
  const old = new Array(n).fill(0)
  for (const i of ds.invoices) {
    const ht = () => totals(i.lines).ht / 100
    if (inP(i.issuedAt, p)) cur[Math.min(n - 1, Math.floor((i.issuedAt - p.from) / bucket))] += ht()
    else if (inP(i.issuedAt, prev)) old[Math.min(n - 1, Math.floor((i.issuedAt - prev.from) / bucket))] += ht()
  }
  return cur.map((v, k) => ({ t: p.from + k * bucket, ca: Math.round(v), precedent: Math.round(old[k]) , bucket }))
}

export function byTechnician(ds: Dataset, p: Period) {
  return ds.technicians.map((t) => {
    const inv = ds.invoices.filter((i) => i.technicianId === t.id && inP(i.issuedAt, p))
    const jobs = ds.jobs.filter((j) => j.technicianId === t.id && j.status === 'terminee' && inP(j.completedAt, p))
    const revs = ds.reviews.filter((r) => r.technicianId === t.id && inP(r.at, p))
    return {
      tech: t,
      revenueHt: inv.reduce((a, i) => a + totals(i.lines).ht, 0),
      jobs: jobs.length,
      avgDuration: jobs.length ? jobs.reduce((a, j) => a + j.durationMin, 0) / jobs.length : 0,
      rating: revs.length ? revs.reduce((a, r) => a + r.rating, 0) / revs.length : null,
      reviews: revs.length,
    }
  }).sort((a, b) => b.revenueHt - a.revenueHt)
}

export function byProblem(ds: Dataset, p: Period) {
  const reqById = new Map(ds.requests.map((r) => [r.id, r]))
  const m = new Map<string, number>()
  for (const i of ds.invoices) {
    if (!inP(i.issuedAt, p)) continue
    const r = reqById.get(i.requestId)
    if (!r) continue
    const k = problemByCode[r.problemTypeCode]?.label ?? r.problemTypeCode
    m.set(k, (m.get(k) ?? 0) + totals(i.lines).ht)
  }
  return [...m.entries()].map(([name, v]) => ({ name, ca: Math.round(v / 100) })).sort((a, b) => b.ca - a.ca)
}

export function bySlot(ds: Dataset, p: Period) {
  const reqById = new Map(ds.requests.map((r) => [r.id, r]))
  const jobById = new Map(ds.jobs.map((j) => [j.id, j]))
  const slots = { 'Jour (8 h – 20 h)': 0, 'Nuit (20 h – 8 h)': 0, 'Week-end et fériés': 0 }
  for (const i of ds.invoices) {
    if (!inP(i.issuedAt, p)) continue
    const r = reqById.get(i.requestId)
    const j = r?.jobId ? jobById.get(r.jobId) : undefined
    const d = new Date(j?.start ?? i.issuedAt)
    const ht = totals(i.lines).ht
    if (d.getDay() === 0 || d.getDay() === 6) slots['Week-end et fériés'] += ht
    else if (d.getHours() >= 20 || d.getHours() < 8) slots['Nuit (20 h – 8 h)'] += ht
    else slots['Jour (8 h – 20 h)'] += ht
  }
  return Object.entries(slots).map(([name, v]) => ({ name, ca: Math.round(v / 100) }))
}

export function byZone(ds: Dataset, p: Period) {
  const reqById = new Map(ds.requests.map((r) => [r.id, r]))
  const clientById = new Map(ds.clients.map((c) => [c.id, c]))
  const m = new Map<string, { cp: string; city: string; ca: number; n: number; lat: number; lng: number }>()
  for (const i of ds.invoices) {
    if (!inP(i.issuedAt, p)) continue
    const r = reqById.get(i.requestId)
    const a = r && clientById.get(r.clientId)?.addresses.find((x) => x.id === r.addressId)
    if (!a) continue
    const z = m.get(a.postalCode) ?? { cp: a.postalCode, city: a.city, ca: 0, n: 0, lat: 0, lng: 0 }
    z.ca += totals(i.lines).ht
    z.n++
    z.lat += a.location.lat
    z.lng += a.location.lng
    m.set(a.postalCode, z)
  }
  return [...m.values()].map((z) => ({ ...z, lat: z.lat / z.n, lng: z.lng / z.n })).sort((a, b) => b.ca - a.ca)
}

/** Demandes par jour de semaine × heure (carte de chaleur des créneaux). */
export function hourHeat(ds: Dataset, p: Period) {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const r of ds.requests) {
    if (!inP(r.createdAt, p)) continue
    const d = new Date(r.createdAt)
    grid[(d.getDay() + 6) % 7][d.getHours()]++
  }
  return grid
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => (typeof c === 'string' && /[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : String(c))).join(';')).join('\n')
}
