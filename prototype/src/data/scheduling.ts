// Suggestion du technicien le plus adapté + calcul d'ETA (simulé : distance à vol d'oiseau × détour, vitesse urbaine).
import { problemByCode } from './reference'
import type { Dataset } from './generate'
import type { LatLng, ServiceRequest, Technician } from './types'
import { DAY, MINUTE } from '@/lib/utils'

export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Temps de trajet estimé (min) : détour routier ×1,35, 24 km/h en ville (trafic inclus dans la vraie version via l'API Routes). */
export function etaMinutes(from: LatLng, to: LatLng) {
  return Math.max(4, Math.round(((distanceKm(from, to) * 1.35) / 24) * 60))
}

export interface Suggestion {
  tech: Technician
  score: number
  etaMin: number
  jobsToday: number
  rating: number | null
  reasons: string[]
  available: boolean
  skilled: boolean
}

export function suggestTechnicians(ds: Dataset, req: ServiceRequest, now = Date.now()): Suggestion[] {
  const skill = problemByCode[req.problemTypeCode]?.skill
  const client = ds.clients.find((c) => c.id === req.clientId)
  const addr = client?.addresses.find((a) => a.id === req.addressId)
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  return ds.technicians
    .filter((t) => t.active)
    .map((tech) => {
      const jobsToday = ds.jobs.filter((j) => j.technicianId === tech.id && j.start >= dayStart.getTime() && j.start < dayStart.getTime() + DAY && j.status !== 'annulee')
      const busy = jobsToday.find((j) => ['en_route', 'sur_place'].includes(j.status))
      const etaBase = addr ? etaMinutes(tech.position, addr.location) : 20
      // S'il est occupé, on ajoute le temps restant estimé de la mission en cours.
      const remaining = busy ? Math.max(10, busy.durationMin - (busy.arrivedAt ? (now - busy.arrivedAt) / MINUTE : 0)) + (busy.status === 'en_route' ? busy.etaMin ?? 10 : 0) : 0
      const etaMin = Math.round(etaBase + remaining)
      const revs = ds.reviews.filter((r) => r.technicianId === tech.id)
      const rating = revs.length ? revs.reduce((a, r) => a + r.rating, 0) / revs.length : null
      const skilled = !skill || tech.skills.includes(skill)
      const reasons: string[] = []
      reasons.push(`${etaMin} min${busy ? ' (après sa mission en cours)' : ''}`)
      reasons.push(`${jobsToday.length} mission${jobsToday.length > 1 ? 's' : ''} aujourd'hui`)
      if (skilled && skill) reasons.push(`compétence « ${skill.toLowerCase()} »`)
      if (!skilled) reasons.push('compétence manquante')
      if (tech.onCall) reasons.push("d'astreinte")
      const score = (skilled ? 50 : 0) + Math.max(0, 30 - etaMin * 0.6) + Math.max(0, 10 - jobsToday.length * 2) + ((rating ?? 4.5) - 4) * 10 + (busy ? -6 : 0)
      return { tech, score: Math.round(score), etaMin, jobsToday: jobsToday.length, rating, reasons, available: !busy, skilled }
    })
    .sort((a, b) => b.score - a.score)
}
