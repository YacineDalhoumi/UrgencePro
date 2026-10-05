import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns'
import { fr } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ——— Formats français ———

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('fr-FR')
const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 })

/** Montant en centimes → « 1 234,56 € » */
export const money = (cents: number) => eur.format(cents / 100)
/** Montant arrondi à l'euro → « 1 235 € » */
export const money0 = (cents: number) => eur0.format(Math.round(cents / 100))
export const n = (v: number) => num.format(v)
export const percent = (ratio: number) => pct.format(ratio)

/** Téléphone E.164 → « 06 39 98 12 34 » */
export function phone(e164: string) {
  const d = e164.replace('+33', '0')
  return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

export const dateFr = (d: Date | number, fmt = 'd MMM yyyy') => format(d, fmt, { locale: fr })
export const timeFr = (d: Date | number) => format(d, 'HH:mm', { locale: fr })
export function dateTimeFr(d: Date | number) {
  if (isToday(d)) return `Aujourd'hui ${timeFr(d)}`
  if (isYesterday(d)) return `Hier ${timeFr(d)}`
  return format(d, "d MMM 'à' HH:mm", { locale: fr })
}
export const ago = (d: Date | number) => `il y a ${formatDistanceToNowStrict(d, { locale: fr })}`

export function durationFr(min: number) {
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

export const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()

let seq = 0
export const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`

/** Variation relative entre deux périodes (null si pas de base de comparaison). */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null
  return (current - previous) / previous
}

/** Copie robuste (le presse-papiers peut être refusé dans certains cadres). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
