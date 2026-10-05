// Moteur de prix — fonction pure : fourchette TTC transparente à partir de la grille tarifaire.
import { CATALOG, HOLIDAYS, SURCHARGES, catalogByCode, problemByCode } from './reference'
import type { Address, Company, DocLine, PriceEstimate, PriceLine, Urgency } from './types'
import { uid } from '@/lib/utils'

/** Zone tarifaire selon le code postal : zone 1 = ville centre, zone 2 = reste de la zone d'intervention. */
export function zoneFor(company: Company, postalCode: string): { zone: 1 | 2 | null; label: string } {
  const centre = company.city === 'Lyon' ? /^6900\d$/.test(postalCode) : /^33(000|100|200|300|800)$/.test(postalCode)
  if (centre) return { zone: 1, label: `Zone 1 — ${company.city} centre` }
  if (company.postalCodes.includes(postalCode)) return { zone: 2, label: 'Zone 2 — agglomération' }
  return { zone: null, label: 'Hors zone' }
}

/** Taux de TVA applicable : 10 % pour un logement de plus de 2 ans (attestation du client), 20 % sinon. */
export function vatFor(address?: Address): number {
  return address?.housingType === 'local_pro' ? 20 : 10
}

/** Majorations horaires applicables à une date d'intervention. */
export function activeSurcharges(at: Date, urgency: Urgency): { key: string; label: string; percent: number }[] {
  const out: { key: string; label: string; percent: number }[] = []
  const h = at.getHours()
  const day = at.getDay()
  const iso = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
  const rule = (k: string) => SURCHARGES.find((s) => s.key === k)!
  // Les majorations horaires ne se cumulent pas : on retient la plus élevée.
  const timeRules = []
  if (h >= 20 || h < 8) timeRules.push(rule('nuit'))
  if (day === 0 || HOLIDAYS.has(iso)) timeRules.push(rule('dimanche_ferie'))
  if (day === 6 && h >= 12 && h < 20) timeRules.push(rule('samedi'))
  if (timeRules.length) {
    const best = timeRules.sort((a, b) => b.percent - a.percent)[0]
    out.push({ key: best.key, label: `${best.label} (+${best.percent} %)`, percent: best.percent })
  }
  if (urgency === 'absolue') {
    const u = rule('urgence')
    out.push({ key: u.key, label: `${u.label} (+${u.percent} %)`, percent: u.percent })
  }
  return out
}

const ttc = (htCents: number, vat: number) => Math.round(htCents * (1 + vat / 100))

export function estimatePrice(args: {
  company: Company
  problemTypeCode: string
  complexity: number
  urgency: Urgency
  at: Date
  address?: Address
}): PriceEstimate {
  const { company, problemTypeCode, complexity, urgency, at, address } = args
  const pt = problemByCode[problemTypeCode]
  const vat = vatFor(address)
  const zone = address ? zoneFor(company, address.postalCode) : { zone: 1 as const, label: 'Zone 1' }
  const lines: PriceLine[] = []
  const surcharges = activeSurcharges(at, urgency)
  const timePct = surcharges.filter((s) => s.key !== 'urgence').reduce((a, s) => a + s.percent, 0)
  const urgPct = surcharges.find((s) => s.key === 'urgence')?.percent ?? 0

  let baseMin = 0
  let baseMax = 0
  for (const it of pt?.items ?? []) {
    const c = catalogByCode[it.code]
    const v = ttc(c.priceHtCents * it.qty, vat)
    lines.push({ label: c.label, detail: `${it.qty} ${c.unit}`, minCents: v, maxCents: v, kind: c.kind })
    if (c.kind !== 'part') { baseMin += v; baseMax += v }
  }
  for (const it of pt?.optional ?? []) {
    const c = catalogByCode[it.code]
    const v = ttc(c.priceHtCents * it.qty, vat)
    lines.push({ label: `${c.label} (si nécessaire)`, detail: `${it.qty} ${c.unit}`, minCents: 0, maxCents: v, kind: c.kind })
    if (c.kind !== 'part') baseMax += v
  }
  // Aléa lié à la complexité : temps de main d'œuvre supplémentaire possible.
  if (complexity >= 3) {
    const mo = catalogByCode['MO-H']
    const v = ttc(mo.priceHtCents * 0.5 * (complexity - 2), vat)
    lines.push({ label: "Main d'œuvre complémentaire (selon diagnostic)", detail: `jusqu'à ${0.5 * (complexity - 2)} h`, minCents: 0, maxCents: v, kind: 'labor' })
    baseMax += v
  }
  if (timePct) {
    lines.push({ label: surcharges.find((s) => s.key !== 'urgence')!.label, minCents: Math.round((baseMin * timePct) / 100), maxCents: Math.round((baseMax * timePct) / 100), kind: 'surcharge' })
  }
  if (urgPct) {
    const forfaits = lines.filter((l) => l.kind === 'service').reduce((a, l) => a + l.minCents, 0)
    const v = Math.round((forfaits * urgPct) / 100)
    lines.push({ label: surcharges.find((s) => s.key === 'urgence')!.label, minCents: v, maxCents: v, kind: 'surcharge' })
  }
  const travel = catalogByCode[zone.zone === 2 ? 'DEP-Z2' : 'DEP-Z1']
  const tv = ttc(travel.priceHtCents, vat)
  lines.push({ label: travel.label, detail: zone.label, minCents: tv, maxCents: tv, kind: 'travel' })

  const minCents = lines.reduce((a, l) => a + l.minCents, 0)
  const maxCents = lines.reduce((a, l) => a + l.maxCents, 0)
  return { minCents, maxCents, lines, surcharges: surcharges.map((s) => s.label), zone: zone.label, outOfZone: zone.zone === null }
}

/** Lignes de devis pré-remplies (HT) à partir de la qualification. */
export function quoteLinesFor(args: { problemTypeCode: string; urgency: Urgency; at: Date; address?: Address; company: Company; includeOptional?: boolean }): DocLine[] {
  const { problemTypeCode, urgency, at, address, company, includeOptional } = args
  const pt = problemByCode[problemTypeCode]
  const vat = vatFor(address)
  const lines: DocLine[] = []
  const add = (code: string, qty: number) => {
    const c = catalogByCode[code]
    lines.push({ id: uid('l'), label: c.label, quantity: qty, unit: c.unit, unitPriceCents: c.priceHtCents, vatRate: c.kind === 'travel' ? vat : vat, kind: c.kind })
  }
  pt?.items.forEach((i) => add(i.code, i.qty))
  if (includeOptional) pt?.optional.slice(0, 1).forEach((i) => add(i.code, i.qty))
  const sur = activeSurcharges(at, urgency)
  const forfaitHt = lines.filter((l) => l.kind === 'service' || l.kind === 'labor').reduce((a, l) => a + l.unitPriceCents * l.quantity, 0)
  for (const s of sur) {
    lines.push({ id: uid('l'), label: `Majoration ${s.label}`, quantity: 1, unit: 'forfait', unitPriceCents: Math.round((forfaitHt * s.percent) / 100), vatRate: vat, kind: 'surcharge' })
  }
  const zone = address ? zoneFor(company, address.postalCode) : { zone: 1 }
  add(zone.zone === 2 ? 'DEP-Z2' : 'DEP-Z1', 1)
  return lines
}

export function totals(lines: DocLine[]) {
  let ht = 0
  const vatByRate = new Map<number, number>()
  for (const l of lines) {
    const lht = Math.round(l.unitPriceCents * l.quantity)
    ht += lht
    vatByRate.set(l.vatRate, (vatByRate.get(l.vatRate) ?? 0) + Math.round((lht * l.vatRate) / 100))
  }
  const vat = [...vatByRate.values()].reduce((a, b) => a + b, 0)
  return { ht, vat, ttc: ht + vat, vatByRate: [...vatByRate.entries()].sort((a, b) => b[0] - a[0]) }
}

export const catalogForTrades = (trades: string[]) => CATALOG.filter((c) => c.trade === 'commun' || trades.includes(c.trade))
