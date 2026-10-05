import * as React from 'react'
import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useLookups } from '@/store/hooks'
import { Badge, Card } from '@/components/ui/primitives'
import { JobBadge, PageHeader, TechChip, UrgencyBadge } from '@/components/shared/bits'
import { CityMap, type MapMarker } from '@/components/shared/CityMap'
import { problemByCode } from '@/data/reference'
import { initials, timeFr, DAY } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function LiveMapPage() {
  const { ds, requests, clients } = useLookups()
  const [focus, setFocus] = React.useState<string | null>(null)
  const day0 = new Date().setHours(0, 0, 0, 0)
  const active = ds.jobs.filter((j) => j.technicianId && j.start >= day0 && j.start < day0 + DAY && !['terminee', 'annulee'].includes(j.status))
  const waiting = ds.requests.filter((r) => ['nouvelle', 'qualifiee', 'devis_envoye', 'acceptee'].includes(r.status) && r.createdAt > Date.now() - 2 * DAY)
  const addr = (reqId: string) => {
    const r = requests.get(reqId)
    return r && clients.get(r.clientId)?.addresses.find((a) => a.id === r.addressId)
  }

  const markers: MapMarker[] = [
    ...waiting.map((r) => ({ id: `w${r.id}`, at: addr(r.id)!.location, kind: 'request' as const, color: 'rgb(var(--warn))', title: `${r.ref} — en attente` })),
    ...active.map((j) => {
      const t = ds.technicians.find((x) => x.id === j.technicianId)!
      return { id: `j${j.id}`, at: addr(j.requestId)!.location, kind: 'job' as const, color: t.color, title: `${requests.get(j.requestId)?.ref} — ${t.firstName}`, label: j.status === 'en_route' ? `${j.etaMin} min` : undefined }
    }),
    ...ds.technicians
      .filter((t) => t.shareLocation)
      .map((t) => {
        const enRoute = ds.jobs.some((j) => j.technicianId === t.id && j.status === 'en_route')
        return { id: t.id, at: t.position, kind: 'tech' as const, color: t.color, label: initials(t.firstName, t.lastName), pulse: enRoute || focus === t.id, title: `${t.firstName} ${t.lastName}`, onClick: () => setFocus(t.id) }
      }),
  ]
  const enRoute = active.find((j) => j.status === 'en_route')
  const routeTech = enRoute && ds.technicians.find((t) => t.id === enRoute.technicianId)

  return (
    <div>
      <PageHeader
        title="Carte en direct"
        subtitle="Positions partagées depuis l’application technicien, uniquement pendant le service."
        actions={
          <Badge tone="ok">
            <Radio className="size-3.5" /> Temps réel
          </Badge>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden p-0">
          <div className="aspect-[1000/680] w-full">
            <CityMap city={ds.company.city} center={ds.company.center} markers={markers} rounded={false} route={enRoute && routeTech ? [routeTech.position, addr(enRoute.requestId)!.location] : undefined} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border px-4 py-2.5 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-accent" /> Technicien
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rotate-45 rounded-sm bg-warn" /> Demande en attente
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full border-2 border-accent" /> Intervention du jour
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-5 border-t-2 border-dashed border-accent" /> Trajet en cours
            </span>
          </div>
        </Card>
        <div className="space-y-3">
          {ds.technicians.map((t) => {
            const cur = ds.jobs.find((j) => j.technicianId === t.id && ['en_route', 'sur_place'].includes(j.status))
            const next = ds.jobs.filter((j) => j.technicianId === t.id && ['proposee', 'acceptee'].includes(j.status)).sort((a, b) => a.start - b.start)[0]
            const r = cur && requests.get(cur.requestId)
            return (
              <Card key={t.id} className={cn('cursor-pointer p-3 transition-colors', focus === t.id && 'border-accent')} onClick={() => setFocus(t.id)}>
                <div className="flex items-center justify-between gap-2">
                  <TechChip tech={t} size={30} />
                  {cur ? <JobBadge s={cur.status} /> : <Badge tone="ok">Disponible</Badge>}
                </div>
                {r && (
                  <div className="mt-2 text-[13px]">
                    <Link to={`/demandes/${r.id}`} className="font-semibold hover:underline">
                      {problemByCode[r.problemTypeCode]?.label}
                    </Link>{' '}
                    <UrgencyBadge u={r.urgency} />
                    <div className="text-muted">
                      {addr(r.id)?.line1}, {addr(r.id)?.city}
                      {cur?.status === 'en_route' && <b className="ml-1 text-accent tnum">· arrivée dans {cur.etaMin} min</b>}
                    </div>
                  </div>
                )}
                {next && <div className="mt-1 text-[12px] text-muted">Suivante : {timeFr(next.start)} · {problemByCode[requests.get(next.requestId)?.problemTypeCode ?? '']?.label}</div>}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
