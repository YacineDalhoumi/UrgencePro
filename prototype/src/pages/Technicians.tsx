import * as React from 'react'
import { Moon, Truck, PackageX, Radio } from 'lucide-react'
import { useLookups } from '@/store/hooks'
import { Badge, Card } from '@/components/ui/primitives'
import { PageHeader, Stars, TechChip } from '@/components/shared/bits'
import { catalogByCode } from '@/data/reference'
import { byTechnician, periodFor } from '@/lib/stats'
import { dateFr, durationFr, money0, phone, DAY } from '@/lib/utils'

export function TechniciansPage() {
  const { ds } = useLookups()
  const stats = React.useMemo(() => new Map(byTechnician(ds, periodFor('30j').cur).map((s) => [s.tech.id, s])), [ds])
  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return (
    <div>
      <PageHeader title="Techniciens" subtitle={`${ds.technicians.length} techniciens · indicateurs sur 30 jours`} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {ds.technicians.map((t) => {
          const s = stats.get(t.id)
          const stock = ds.stock.filter((x) => x.technicianId === t.id)
          const low = stock.filter((x) => x.qty < x.min)
          return (
            <Card key={t.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <TechChip tech={t} size={40} />
                  <div className="ml-12 -mt-1 text-[13px] text-muted tnum">{phone(t.phone)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {t.onCall && (
                    <Badge tone="accent">
                      <Moon className="size-3.5" /> Astreinte cette semaine
                    </Badge>
                  )}
                  {t.shareLocation && (
                    <Badge tone="ok">
                      <Radio className="size-3.5" /> Position partagée
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.skills.map((k) => (
                  <Badge key={k}>{k}</Badge>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[
                  ['CA HT', money0(s?.revenueHt ?? 0)],
                  ['Interv.', String(s?.jobs ?? 0)],
                  ['Durée moy.', s?.avgDuration ? durationFr(s.avgDuration) : '—'],
                  ['Note', s?.rating ? s.rating.toFixed(1).replace('.', ',') : '—'],
                ].map(([l, v]) => (
                  <div key={l} className="rounded bg-sunken px-1 py-2">
                    <div className="font-display text-[15px] font-bold tnum">{v}</div>
                    <div className="text-[11px] text-muted">{l}</div>
                  </div>
                ))}
              </div>
              {s?.rating && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
                  <Stars value={s.rating} /> {s.reviews} avis sur 30 jours
                </div>
              )}
              <div className="mt-3 border-t border-border pt-3 text-sm">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Truck className="size-4 text-muted" /> {t.vehicle}
                  </span>
                  {low.length > 0 ? (
                    <Badge tone="bad">
                      <PackageX className="size-3.5" /> {low.length} stock bas
                    </Badge>
                  ) : (
                    <Badge tone="ok">Stock OK</Badge>
                  )}
                </div>
                <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-[13px] sm:grid-cols-2">
                  {stock.map((x) => (
                    <li key={x.code} className="flex justify-between gap-2">
                      <span className="truncate text-muted">{catalogByCode[x.code]?.label}</span>
                      <span className={x.qty < x.min ? 'font-bold text-bad tnum' : 'tnum'}>
                        {x.qty}
                        <span className="text-muted">/{x.min}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <div className="label-caps mb-1.5 text-muted">Semaine</div>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = monday.getTime() + i * DAY
                    const off = (t.id.endsWith('5') && i === 2) || (i === 6 && !t.onCall)
                    const count = ds.jobs.filter((j) => j.technicianId === t.id && j.start >= d && j.start < d + DAY).length
                    return (
                      <div key={i} className={off ? 'rounded bg-sunken py-1 text-muted' : 'rounded border border-border py-1'}>
                        <div className="font-semibold capitalize">{dateFr(d, 'EEE')}</div>
                        <div className="tnum">{off ? (i === 6 ? 'repos' : 'congé') : count || '·'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
