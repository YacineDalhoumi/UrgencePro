// Carte stylisée en SVG (aucune tuile externe dans la démo — en production : Google Maps).
import * as React from 'react'
import type { LatLng } from '@/data/types'
import { cn } from '@/lib/utils'

export interface MapMarker {
  id: string
  at: LatLng
  kind: 'tech' | 'job' | 'request' | 'home' | 'dot'
  color?: string
  label?: string
  title?: string
  pulse?: boolean
  onClick?: () => void
}

export interface HeatPoint {
  at: LatLng
  weight: number
}

const W = 1000
const H = 680

type City = 'Lyon' | 'Bordeaux'

const RIVERS: Record<City, LatLng[][]> = {
  Lyon: [
    // Saône
    [{ lat: 45.83, lng: 4.83 }, { lat: 45.805, lng: 4.818 }, { lat: 45.785, lng: 4.808 }, { lat: 45.772, lng: 4.818 }, { lat: 45.764, lng: 4.828 }, { lat: 45.752, lng: 4.826 }, { lat: 45.74, lng: 4.818 }, { lat: 45.729, lng: 4.818 }],
    // Rhône
    [{ lat: 45.81, lng: 4.95 }, { lat: 45.795, lng: 4.9 }, { lat: 45.783, lng: 4.862 }, { lat: 45.772, lng: 4.845 }, { lat: 45.758, lng: 4.842 }, { lat: 45.744, lng: 4.835 }, { lat: 45.729, lng: 4.818 }, { lat: 45.7, lng: 4.8 }, { lat: 45.67, lng: 4.79 }],
  ],
  Bordeaux: [
    [{ lat: 44.77, lng: -0.52 }, { lat: 44.8, lng: -0.535 }, { lat: 44.82, lng: -0.553 }, { lat: 44.835, lng: -0.565 }, { lat: 44.848, lng: -0.566 }, { lat: 44.862, lng: -0.556 }, { lat: 44.877, lng: -0.54 }, { lat: 44.9, lng: -0.535 }, { lat: 44.93, lng: -0.54 }],
  ],
}

const PARKS: Record<City, { at: LatLng; rx: number; ry: number }[]> = {
  Lyon: [
    { at: { lat: 45.778, lng: 4.852 }, rx: 40, ry: 30 },
    { at: { lat: 45.73, lng: 4.84 }, rx: 30, ry: 18 },
    { at: { lat: 45.765, lng: 4.81 }, rx: 22, ry: 14 },
  ],
  Bordeaux: [
    { at: { lat: 44.848, lng: -0.584 }, rx: 30, ry: 18 },
    { at: { lat: 44.86, lng: -0.6 }, rx: 22, ry: 26 },
  ],
}

export function useProjection(center: LatLng, zoom = 1) {
  return React.useMemo(() => {
    const spanLng = 0.2 / zoom
    const spanLat = ((spanLng * H) / W) * Math.cos((center.lat * Math.PI) / 180)
    return (p: LatLng) => ({ x: ((p.lng - center.lng) / spanLng + 0.5) * W, y: (0.5 - (p.lat - center.lat) / spanLat) * H })
  }, [center.lat, center.lng, zoom])
}

export function CityMap({
  city,
  center,
  markers = [],
  heat,
  route,
  zoom = 1,
  className,
  rounded = true,
}: {
  city: string
  center: LatLng
  markers?: MapMarker[]
  heat?: HeatPoint[]
  route?: [LatLng, LatLng]
  zoom?: number
  className?: string
  rounded?: boolean
}) {
  const proj = useProjection(center, zoom)
  const c = (city === 'Bordeaux' ? 'Bordeaux' : 'Lyon') as City
  const line = (pts: LatLng[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${proj(p).x.toFixed(1)} ${proj(p).y.toFixed(1)}`).join(' ')
  const ctr = proj(center)
  const maxW = heat ? Math.max(...heat.map((h) => h.weight), 1) : 1

  // Trame de rues pseudo-aléatoire mais stable
  const streets = React.useMemo(() => {
    const out: string[] = []
    let seed = c === 'Lyon' ? 7 : 13
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    for (let i = 0; i < 46; i++) {
      const x = rnd() * W
      const y = rnd() * H
      const len = 80 + rnd() * 220
      const ang = (rnd() > 0.5 ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.5
      out.push(`M${x.toFixed(0)} ${y.toFixed(0)} l${(Math.cos(ang) * len).toFixed(0)} ${(Math.sin(ang) * len).toFixed(0)}`)
    }
    return out
  }, [c])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('block h-full w-full', rounded && 'rounded-md', className)} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Carte de ${city}`}>
      <rect width={W} height={H} fill="rgb(var(--map-land))" />
      {PARKS[c].map((p, i) => {
        const q = proj(p.at)
        return <ellipse key={i} cx={q.x} cy={q.y} rx={p.rx * zoom} ry={p.ry * zoom} fill="rgb(var(--map-park))" />
      })}
      {streets.map((d, i) => (
        <path key={i} d={d} stroke="rgb(var(--map-road))" strokeWidth={3} fill="none" strokeLinecap="round" />
      ))}
      {/* Rocade */}
      <ellipse cx={ctr.x} cy={ctr.y} rx={360 * zoom} ry={250 * zoom} fill="none" stroke="rgb(var(--map-road))" strokeWidth={9} />
      <ellipse cx={ctr.x} cy={ctr.y} rx={360 * zoom} ry={250 * zoom} fill="none" stroke="rgb(var(--border))" strokeWidth={1} strokeDasharray="2 10" />
      {/* Axes principaux */}
      <path d={`M0 ${ctr.y + 30} L${W} ${ctr.y - 40}`} stroke="rgb(var(--map-road))" strokeWidth={7} fill="none" />
      <path d={`M${ctr.x - 60} 0 L${ctr.x + 40} ${H}`} stroke="rgb(var(--map-road))" strokeWidth={7} fill="none" />
      {RIVERS[c].map((r, i) => (
        <path key={i} d={line(r)} stroke="rgb(var(--map-water))" strokeWidth={c === 'Bordeaux' ? 26 * zoom : 16 * zoom} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {heat?.map((h, i) => {
        const q = proj(h.at)
        const r = 18 + (h.weight / maxW) * 70
        return <circle key={i} cx={q.x} cy={q.y} r={r} fill="rgb(var(--accent))" opacity={0.12 + (h.weight / maxW) * 0.4} />
      })}

      {route && (
        <path d={line(route)} stroke="rgb(var(--accent))" strokeWidth={5} strokeDasharray="10 8" fill="none" strokeLinecap="round" />
      )}

      {markers.map((m) => {
        const q = proj(m.at)
        const color = m.color ?? 'rgb(var(--accent))'
        return (
          <g key={m.id} transform={`translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`} onClick={m.onClick} style={{ cursor: m.onClick ? 'pointer' : undefined }}>
            {m.title && <title>{m.title}</title>}
            {m.pulse && <circle r={16} fill={color} className="pulse-ring" />}
            {m.kind === 'tech' && (
              <>
                <circle r={17} fill={color} stroke="rgb(var(--surface))" strokeWidth={3} />
                <text textAnchor="middle" dy="5" fontSize="13" fontWeight="700" fill="#ffffff">
                  {m.label}
                </text>
              </>
            )}
            {m.kind === 'job' && (
              <>
                <path d="M0 0 C-11 -14 -14 -20 -14 -26 A14 14 0 1 1 14 -26 C14 -20 11 -14 0 0Z" fill={color} stroke="rgb(var(--surface))" strokeWidth={2.5} />
                <circle cy={-26} r={5} fill="rgb(var(--surface))" />
              </>
            )}
            {m.kind === 'request' && <rect x={-8} y={-8} width={16} height={16} rx={3} transform="rotate(45)" fill={color} stroke="rgb(var(--surface))" strokeWidth={2.5} />}
            {m.kind === 'home' && (
              <>
                <circle r={13} fill="rgb(var(--ink))" stroke="rgb(var(--surface))" strokeWidth={3} />
                <path d="M-6 2 L0 -5 L6 2 V7 H-6Z" fill="rgb(var(--ink-fg))" />
              </>
            )}
            {m.kind === 'dot' && <circle r={5} fill={color} opacity={0.75} />}
            {m.label && m.kind !== 'tech' && (
              <text y={m.kind === 'job' ? -46 : -16} textAnchor="middle" fontSize="13" fontWeight="700" fill="rgb(var(--fg))" stroke="rgb(var(--surface))" strokeWidth={4} paintOrder="stroke">
                {m.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
