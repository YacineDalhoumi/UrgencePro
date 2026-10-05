import * as React from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDs } from '@/store/hooks'
import { Card, CardHeader } from '@/components/ui/primitives'
import { PageHeader } from '@/components/shared/bits'
import { CsvExport } from '@/components/shared/CsvDialog'
import { PeriodPicker, usePeriod } from './Dashboard'
import { byZone, hourHeat, kpis, toCsv } from '@/lib/stats'
import { useChartColors } from '@/lib/theme'
import { SOURCE_LABEL } from '@/data/reference'
import type { RequestSource } from '@/data/types'
import { money0, n, percent } from '@/lib/utils'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function StatsPage() {
  const ds = useDs()
  const P = usePeriod('mois')
  const col = useChartColors()
  const inP = (t: number) => t >= P.cur.from && t < P.cur.to
  const heat = React.useMemo(() => hourHeat(ds, P.cur), [ds, P.cur])
  const max = Math.max(1, ...heat.flat())
  const k = React.useMemo(() => kpis(ds, P.cur), [ds, P.cur])
  const zones = React.useMemo(() => byZone(ds, P.cur), [ds, P.cur])

  const bySource = React.useMemo(() => {
    const m = new Map<RequestSource, { total: number; won: number }>()
    for (const r of ds.requests) {
      if (!inP(r.createdAt)) continue
      const s = m.get(r.source) ?? { total: 0, won: 0 }
      s.total++
      if (r.history.some((h) => h.status === 'terminee')) s.won++
      m.set(r.source, s)
    }
    return [...m.entries()].map(([s, v]) => ({ name: SOURCE_LABEL[s], demandes: v.total, conversion: Math.round((v.won / v.total) * 100) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds.requests, P.cur])

  const lost = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const r of ds.requests) if (inP(r.createdAt) && r.status === 'perdue') m.set(r.lostReason ?? 'Autre', (m.get(r.lostReason ?? 'Autre') ?? 0) + 1)
    return [...m.entries()].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds.requests, P.cur])

  const tooltip = { contentStyle: { background: col.surface, border: `1px solid ${col.grid}`, borderRadius: 8, color: col.fg }, cursor: { fill: col.sunken } }

  return (
    <div>
      <PageHeader
        title="Statistiques"
        subtitle="Analyse détaillée de l’activité"
        actions={
          <CsvExport
            filename="statistiques-zones.csv"
            build={() => toCsv([['Code postal', 'Ville', 'Interventions facturées', 'CA HT (€)'], ...zones.map((z) => [z.cp, z.city, z.n, (z.ca / 100).toFixed(2)])])}
          />
        }
      />
      <div className="mb-4">
        <PeriodPicker value={P.key} onChange={P.setKey} custom={P.custom} setCustom={P.setCustom} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Demandes', n(k.funnel[1].value)],
          ['Taux de transformation', k.funnel[1].value ? percent(k.funnel[3].value / k.funnel[1].value) : '—'],
          ['Appels gérés par l’agent IA', n(k.aiHandled)],
          ['Délai moyen d’arrivée', k.avgArrival ? `${Math.round(k.avgArrival)} min` : '—'],
        ].map(([l, v]) => (
          <Card key={l} className="p-4">
            <div className="label-caps text-muted">{l}</div>
            <div className="mt-1 font-display text-2xl font-extrabold tnum">{v}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-3">
        <CardHeader title="Quand arrivent les demandes ?" subtitle="Demandes par jour et par heure — pour dimensionner astreintes et standard" />
        <div className="scroll-thin overflow-x-auto px-4 pb-4">
          <div className="min-w-[720px]">
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: '40px repeat(24, 1fr)' }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-center text-[10px] text-muted tnum">
                  {h % 3 === 0 ? `${h}h` : ''}
                </div>
              ))}
              {heat.map((row, d) => (
                <React.Fragment key={d}>
                  <div className="self-center text-[12px] font-semibold text-muted">{DAYS[d]}</div>
                  {row.map((v, h) => (
                    <div key={h} className="aspect-square rounded-sm" title={`${DAYS[d]} ${h} h : ${v} demande${v > 1 ? 's' : ''}`} style={{ background: v ? `rgb(var(--accent) / ${0.1 + (v / max) * 0.9})` : 'rgb(var(--sunken))' }} />
                  ))}
                </React.Fragment>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-muted">
              Moins
              {[0.1, 0.3, 0.55, 0.8, 1].map((o) => (
                <span key={o} className="size-3 rounded-sm" style={{ background: `rgb(var(--accent) / ${o})` }} />
              ))}
              Plus
            </div>
          </div>
        </div>
      </Card>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Canaux d’entrée" subtitle="Demandes et % transformées en intervention" />
          <div className="h-[260px] px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySource} margin={{ top: 8, right: 8 }}>
                <CartesianGrid stroke={col.grid} strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: col.muted, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: col.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip {...tooltip} formatter={(v: number, name) => [name === 'conversion' ? `${v} %` : v, name === 'conversion' ? 'Transformation' : 'Demandes']} />
                <Bar dataKey="demandes" fill={col.c2} radius={[3, 3, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-4 text-[12px] text-muted">
            {bySource.map((s) => (
              <span key={s.name}>
                {s.name} : <b className="text-fg tnum">{s.conversion} %</b>
              </span>
            ))}
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Pourquoi perd-on des demandes ?" subtitle="Motifs saisis à la clôture" />
          <div className="h-[260px] px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lost} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={170} tick={{ fill: col.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltip} formatter={(v: number) => [v, 'Demandes perdues']} />
                <Bar dataKey="v" fill={col.c6} radius={[0, 3, 3, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card className="mt-3 overflow-hidden">
        <CardHeader title="CA par code postal" />
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-sunken text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Code postal</th>
                <th className="px-3 py-2 font-semibold">Ville</th>
                <th className="px-3 py-2 text-right font-semibold">Interventions</th>
                <th className="px-3 py-2 text-right font-semibold">CA HT</th>
                <th className="w-1/3 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.cp} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">{z.cp}</td>
                  <td className="px-3 py-2">{z.city}</td>
                  <td className="px-3 py-2 text-right tnum">{z.n}</td>
                  <td className="px-3 py-2 text-right font-semibold tnum">{money0(z.ca)}</td>
                  <td className="px-3 py-2">
                    <div className="h-2 rounded-sm bg-sunken">
                      <div className="h-full rounded-sm bg-accent" style={{ width: `${(z.ca / (zones[0]?.ca || 1)) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
