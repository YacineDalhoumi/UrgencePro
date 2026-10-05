import * as React from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Sparkles, CalendarClock, FileClock, AlertTriangle, PhoneMissed, ChevronRight } from 'lucide-react'
import { useDs } from '@/store/hooks'
import { Card, CardHeader, Input } from '@/components/ui/primitives'
import { Delta, PageHeader, Stars, TechChip } from '@/components/shared/bits'
import { CityMap } from '@/components/shared/CityMap'
import { CsvExport } from '@/components/shared/CsvDialog'
import { byProblem, bySlot, byTechnician, byZone, kpis, periodFor, revenueSeries, toCsv, type PeriodKey } from '@/lib/stats'
import { useChartColors } from '@/lib/theme'
import { cn, dateFr, delta, durationFr, money0, n, percent, DAY } from '@/lib/utils'

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'jour', label: "Aujourd'hui" },
  { key: '7j', label: '7 jours' },
  { key: '30j', label: '30 jours' },
  { key: 'mois', label: 'Ce mois' },
  { key: 'annee', label: 'Année' },
  { key: 'perso', label: 'Personnalisée' },
]

export function PeriodPicker({ value, onChange, custom, setCustom }: { value: PeriodKey; onChange: (k: PeriodKey) => void; custom: { from: string; to: string }; setCustom: (c: { from: string; to: string }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="scroll-thin flex max-w-full overflow-x-auto rounded border border-border bg-surface p-0.5" role="tablist" aria-label="Période">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={value === p.key}
            onClick={() => onChange(p.key)}
            className={cn('h-8 whitespace-nowrap rounded px-3 text-[13px] font-semibold', value === p.key ? 'bg-ink text-ink-fg' : 'text-muted hover:text-fg')}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value === 'perso' && (
        <div className="flex items-center gap-1.5">
          <Input id="period-from" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-9 w-[150px]" aria-label="Du" />
          <span className="text-muted">→</span>
          <Input id="period-to" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-9 w-[150px]" aria-label="Au" />
        </div>
      )}
    </div>
  )
}

export function usePeriod(initial: PeriodKey = '30j') {
  const [key, setKey] = React.useState<PeriodKey>(initial)
  const today = new Date().toISOString().slice(0, 10)
  const [custom, setCustom] = React.useState({ from: new Date(Date.now() - 90 * DAY).toISOString().slice(0, 10), to: today })
  const period = React.useMemo(
    () => periodFor(key, Date.now(), { from: new Date(custom.from).getTime(), to: new Date(custom.to).getTime() + DAY }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, custom.from, custom.to],
  )
  return { key, setKey, custom, setCustom, ...period }
}

function Kpi({ label, value, d, sub, invert }: { label: string; value: string; d?: number | null; sub?: React.ReactNode; invert?: boolean }) {
  return (
    <Card className="flex min-w-0 flex-col gap-1 p-4">
      <div className="label-caps text-muted">{label}</div>
      <div className="font-display text-[26px] font-extrabold leading-none tracking-tight tnum">{value}</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
        {d !== undefined && <Delta value={d} invert={invert} />}
        {sub}
      </div>
    </Card>
  )
}

function TodoStrip() {
  const ds = useDs()
  const items = React.useMemo(() => {
    const dayStart = new Date().setHours(0, 0, 0, 0)
    const aiPending = ds.requests.filter((r) => r.ai?.reviewStatus === 'proposed')
    const toPlan = ds.jobs.filter((j) => j.status === 'a_planifier')
    const viewed = ds.quotes.filter((q) => q.status === 'consulte' || (q.status === 'envoye' && q.sentAt! < Date.now() - DAY))
    const missed = ds.calls.filter((c) => c.at >= dayStart && (c.status === 'manque' || c.status === 'messagerie'))
    const overdue = ds.invoices.filter((i) => i.status === 'en_retard')
    return [
      { icon: Sparkles, tone: 'text-ai bg-ai-soft', n: aiPending.length, label: 'qualification IA à valider', many: 'qualifications IA à valider', to: aiPending[0] ? `/demandes/${aiPending[0].id}` : '/demandes' },
      { icon: CalendarClock, tone: 'text-warn bg-warn-soft', n: toPlan.length, label: 'intervention à planifier', many: 'interventions à planifier', to: '/planning' },
      { icon: FileClock, tone: 'text-info bg-info-soft', n: viewed.length, label: 'devis consulté non signé', many: 'devis en attente de signature', to: '/devis' },
      { icon: PhoneMissed, tone: 'text-bad bg-bad-soft', n: missed.length, label: "appel manqué aujourd'hui", many: "appels manqués aujourd'hui", to: '/appels' },
      { icon: AlertTriangle, tone: 'text-bad bg-bad-soft', n: overdue.length, label: 'facture en retard', many: 'factures en retard', to: '/factures' },
    ]
  }, [ds.requests, ds.jobs, ds.quotes, ds.calls, ds.invoices])
  return (
    <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((it) => (
        <Link key={it.label} to={it.to} className="group flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 hover:border-accent/50">
          <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded', it.tone)}>
            <it.icon className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1 text-sm leading-tight">
            <span className="font-display text-lg font-extrabold tnum">{it.n}</span> {it.n > 1 ? it.many : it.label}
          </span>
          <ChevronRight className="size-4 text-muted group-hover:text-accent" />
        </Link>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const ds = useDs()
  const P = usePeriod('30j')
  const col = useChartColors()
  const k = React.useMemo(() => kpis(ds, P.cur), [ds, P.cur])
  const kp = React.useMemo(() => kpis(ds, P.prev), [ds, P.prev])
  const series = React.useMemo(() => revenueSeries(ds, P.cur, P.prev), [ds, P.cur, P.prev])
  const techs = React.useMemo(() => byTechnician(ds, P.cur), [ds, P.cur])
  const problems = React.useMemo(() => byProblem(ds, P.cur).slice(0, 6), [ds, P.cur])
  const slots = React.useMemo(() => bySlot(ds, P.cur), [ds, P.cur])
  const zones = React.useMemo(() => byZone(ds, P.cur), [ds, P.cur])
  const hourly = series[0]?.bucket === 3600_000

  const csv = () =>
    toCsv([
      ['Indicateur', 'Période', 'Période précédente'],
      ['CA HT (€)', (k.revenueHt / 100).toFixed(2), (kp.revenueHt / 100).toFixed(2)],
      ['Interventions', k.jobs, kp.jobs],
      ['Panier moyen HT (€)', (k.avgBasket / 100).toFixed(2), (kp.avgBasket / 100).toFixed(2)],
      ['Nouveaux clients', k.newClients, kp.newClients],
      ['Clients récurrents', k.returning, kp.returning],
      ['Appels reçus', k.calls, kp.calls],
      ['Appels manqués', k.missed, kp.missed],
      ['Délai moyen d’arrivée (min)', Math.round(k.avgArrival), Math.round(kp.avgArrival)],
      ['Taux d’acceptation des devis', percent(k.acceptance), percent(kp.acceptance)],
      [],
      ['Technicien', 'CA HT (€)', 'Interventions', 'Durée moyenne (min)', 'Note'],
      ...techs.map((t) => [`${t.tech.firstName} ${t.tech.lastName}`, (t.revenueHt / 100).toFixed(2), t.jobs, Math.round(t.avgDuration), t.rating?.toFixed(2) ?? '']),
    ])

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={`${ds.company.name} · comparaison avec ${P.label}`}
        actions={<CsvExport filename="tableau-de-bord.csv" build={csv} />}
      />
      <TodoStrip />
      <div className="mb-4">
        <PeriodPicker value={P.key} onChange={P.setKey} custom={P.custom} setCustom={P.setCustom} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Chiffre d’affaires HT" value={money0(k.revenueHt)} d={delta(k.revenueHt, kp.revenueHt)} sub={`${n(k.invoices)} factures`} />
        <Kpi label="Interventions" value={n(k.jobs)} d={delta(k.jobs, kp.jobs)} />
        <Kpi label="Panier moyen HT" value={money0(k.avgBasket)} d={delta(k.avgBasket, kp.avgBasket)} />
        <Kpi label="Clients" value={n(k.newClients + k.returning)} sub={<span>{n(k.newClients)} nouveaux · {n(k.returning)} récurrents</span>} />
        <Kpi label="Appels reçus" value={n(k.calls)} d={delta(k.calls, kp.calls)} sub={<span className={k.missed ? 'text-bad' : ''}>{n(k.missed)} manqués · {n(k.aiHandled)} agent IA</span>} />
        <Kpi label="Délai d’arrivée" value={k.avgArrival ? durationFr(k.avgArrival) : '—'} d={delta(k.avgArrival, kp.avgArrival)} invert sub="urgences, de l’appel à l’arrivée" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Chiffre d’affaires HT" subtitle={`Période en cours et ${P.label}`} />
          <div className="h-[260px] px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="caFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={col.c1} stopOpacity={0.28} />
                    <stop offset="1" stopColor={col.c1} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={col.grid} strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => (hourly ? `${new Date(t).getHours()} h` : dateFr(t, 'd MMM'))} tick={{ fill: col.muted, fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10} k€` : `${v} €`)} tick={{ fill: col.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  contentStyle={{ background: col.surface, border: `1px solid ${col.grid}`, borderRadius: 8, color: col.fg }}
                  labelFormatter={(t) => (hourly ? `${new Date(t as number).getHours()} h` : dateFr(t as number, 'EEEE d MMM'))}
                  formatter={(v: number, name) => [money0(v * 100), name === 'ca' ? 'Période' : 'Précédente']}
                />
                <Area type="monotone" dataKey="precedent" stroke={col.muted} strokeDasharray="4 4" fill="none" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="ca" stroke={col.c1} fill="url(#caFill)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Conversion" subtitle="Du premier contact au paiement" />
          <div className="space-y-2.5 px-4 pb-4">
            {k.funnel.map((f, i) => {
              const max = k.funnel[0].value || 1
              const prev = i ? k.funnel[i - 1].value : 0
              return (
                <div key={f.stage}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{f.stage}</span>
                    <span className="tnum">
                      <span className="font-bold">{n(f.value)}</span>
                      {i > 0 && <span className="ml-2 text-[12px] text-muted">{prev ? percent(f.value / prev) : '—'}</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-sm bg-sunken">
                    <div className="h-full rounded-sm bg-accent" style={{ width: `${(f.value / max) * 100}%`, opacity: 1 - i * 0.14 }} />
                  </div>
                </div>
              )
            })}
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
              <div>
                <div className="text-[12px] text-muted">Devis acceptés</div>
                <div className="font-display text-lg font-bold tnum">{percent(k.acceptance)}</div>
              </div>
              <div>
                <div className="text-[12px] text-muted">Devis en attente</div>
                <div className="font-display text-lg font-bold tnum">{money0(k.pendingQuotesAmount)}</div>
              </div>
              <div>
                <div className="text-[12px] text-muted">Factures impayées</div>
                <div className="font-display text-lg font-bold tnum">{money0(k.unpaidAmount)}</div>
              </div>
              <div>
                <div className="text-[12px] text-muted">dont en retard</div>
                <div className={cn('font-display text-lg font-bold tnum', k.overdue && 'text-bad')}>{n(k.overdue)}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Performance par technicien" action={<Link to="/techniciens" className="text-[13px] font-semibold text-accent hover:underline">Équipe</Link>} />
          <div className="scroll-thin overflow-x-auto px-4 pb-3">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="py-2 font-semibold">Technicien</th>
                  <th className="py-2 text-right font-semibold">CA HT</th>
                  <th className="py-2 text-right font-semibold">Interventions</th>
                  <th className="py-2 text-right font-semibold">Durée moy.</th>
                  <th className="py-2 pl-4 font-semibold">Note client</th>
                </tr>
              </thead>
              <tbody>
                {techs.map((t) => {
                  const max = techs[0]?.revenueHt || 1
                  return (
                    <tr key={t.tech.id} className="border-t border-border">
                      <td className="py-2.5">
                        <TechChip tech={t.tech} />
                      </td>
                      <td className="py-2.5 text-right tnum">
                        <div className="font-semibold">{money0(t.revenueHt)}</div>
                        <div className="ml-auto mt-1 h-1 w-24 rounded-sm bg-sunken">
                          <div className="h-full rounded-sm" style={{ width: `${(t.revenueHt / max) * 100}%`, background: t.tech.color }} />
                        </div>
                      </td>
                      <td className="py-2.5 text-right tnum">{n(t.jobs)}</td>
                      <td className="py-2.5 text-right tnum">{t.avgDuration ? durationFr(t.avgDuration) : '—'}</td>
                      <td className="py-2.5 pl-4">
                        {t.rating ? (
                          <span className="inline-flex items-center gap-1.5 tnum">
                            <Stars value={t.rating} /> {t.rating.toFixed(1).replace('.', ',')} <span className="text-[12px] text-muted">({t.reviews})</span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Avis clients" subtitle="Google et retours internes" />
          <div className="px-4 pb-4">
            <div className="flex items-end gap-3">
              <div className="font-display text-4xl font-extrabold tnum">{ds.company.googleRating.toFixed(1).replace('.', ',')}</div>
              <div className="pb-1">
                <Stars value={ds.company.googleRating} size={16} />
                <div className="text-[12px] text-muted">{n(ds.company.googleReviewCount + k.googleNew)} avis Google</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded bg-sunken p-2.5">
                <div className="text-[12px] text-muted">Nouveaux avis Google</div>
                <div className="font-display text-lg font-bold tnum">+{n(k.googleNew)}</div>
              </div>
              <div className="rounded bg-sunken p-2.5">
                <div className="text-[12px] text-muted">Note moyenne période</div>
                <div className="font-display text-lg font-bold tnum">{k.avgRating ? k.avgRating.toFixed(2).replace('.', ',') : '—'}</div>
              </div>
            </div>
            <Link to="/avis" className="mt-3 inline-block text-[13px] font-semibold text-accent hover:underline">
              Voir les avis
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader title="CA par type d’intervention" />
          <div className="h-[250px] px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={problems} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={150} tick={{ fill: col.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: col.sunken }} contentStyle={{ background: col.surface, border: `1px solid ${col.grid}`, borderRadius: 8, color: col.fg }} formatter={(v: number) => [money0(v * 100), 'CA HT']} />
                <Bar dataKey="ca" fill={col.c2} radius={[0, 3, 3, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="CA par créneau" subtitle="Jour, nuit, week-end" />
          <div className="h-[250px] px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slots} margin={{ top: 8, left: 0, right: 8 }}>
                <CartesianGrid stroke={col.grid} strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: col.muted, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)} k€`} tick={{ fill: col.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip cursor={{ fill: col.sunken }} contentStyle={{ background: col.surface, border: `1px solid ${col.grid}`, borderRadius: 8, color: col.fg }} formatter={(v: number) => [money0(v * 100), 'CA HT']} />
                <Bar dataKey="ca" radius={[3, 3, 0, 0]} barSize={42}>
                  {slots.map((_, i) => (
                    <Cell key={i} fill={[col.c4, col.c5, col.c1][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="min-w-0 lg:col-span-2 xl:col-span-1">
          <CardHeader title="CA par zone" subtitle="Carte de chaleur par code postal" />
          <div className="px-4 pb-4">
            <div className="aspect-[1000/680] w-full max-w-full overflow-hidden rounded">
              <CityMap city={ds.company.city} center={ds.company.center} heat={zones.map((z) => ({ at: { lat: z.lat, lng: z.lng }, weight: z.ca }))} markers={zones.slice(0, 3).map((z) => ({ id: z.cp, at: { lat: z.lat, lng: z.lng }, kind: 'dot' as const, label: z.cp }))} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
              {zones.slice(0, 3).map((z) => (
                <span key={z.cp} className="tnum">
                  <b className="text-fg">{z.cp}</b> {z.city} · {money0(z.ca)}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
