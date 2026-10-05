import * as React from 'react'
import { useLookups } from '@/store/hooks'
import { Badge, Card, CardHeader, Field, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives'
import { PageHeader, PriceBreakdown } from '@/components/shared/bits'
import { CityMap } from '@/components/shared/CityMap'
import { catalogForTrades, estimatePrice, zoneFor } from '@/data/pricing'
import { PROBLEM_TYPES, SURCHARGES, URGENCY, TRADE_LABEL, catalogByCode } from '@/data/reference'
import type { Urgency } from '@/data/types'
import { durationFr, money } from '@/lib/utils'

export function CatalogPage() {
  const { ds } = useLookups()
  const items = catalogForTrades(ds.company.trades)
  const problems = PROBLEM_TYPES.filter((p) => ds.company.trades.includes(p.trade))
  return (
    <div>
      <PageHeader title="Catalogue et tarifs" subtitle="La grille qui alimente les fourchettes de prix, les devis et les suggestions de l’IA." />
      <Tabs defaultValue="simulateur">
        <TabsList>
          <TabsTrigger value="simulateur">Simulateur de prix</TabsTrigger>
          <TabsTrigger value="catalogue">Prestations et pièces</TabsTrigger>
          <TabsTrigger value="problemes">Types de problèmes</TabsTrigger>
          <TabsTrigger value="majorations">Majorations</TabsTrigger>
          <TabsTrigger value="zones">Zones et déplacement</TabsTrigger>
        </TabsList>
        <TabsContent value="simulateur" className="pt-4">
          <Simulator />
        </TabsContent>
        <TabsContent value="catalogue" className="pt-4">
          <Card className="overflow-hidden">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-sunken text-left text-[12px] text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Référence</th>
                    <th className="px-3 py-2.5 font-semibold">Désignation</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Unité</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Prix HT</th>
                    <th className="px-3 py-2.5 text-right font-semibold">TTC (10 %)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.code} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-[12px]">{c.code}</td>
                      <td className="px-3 py-2 font-semibold">{c.label}</td>
                      <td className="px-3 py-2">
                        <Badge tone={c.kind === 'part' ? 'info' : c.kind === 'travel' ? 'warn' : 'neutral'}>{{ service: 'Forfait', labor: 'Main d’œuvre', part: 'Pièce', travel: 'Déplacement' }[c.kind]}</Badge>
                      </td>
                      <td className="px-3 py-2">{c.unit}</td>
                      <td className="px-3 py-2 text-right tnum">{money(c.priceHtCents)}</td>
                      <td className="px-3 py-2 text-right text-muted tnum">{money(Math.round(c.priceHtCents * 1.1))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="problemes" className="pt-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {problems.map((p) => (
              <Card key={p.code} className="p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-[15px] font-bold">{p.label}</div>
                    <div className="text-[12px] text-muted">
                      {TRADE_LABEL[p.trade]} · compétence « {p.skill} »
                    </div>
                  </div>
                  <Badge>Complexité {p.complexity}/5</Badge>
                </div>
                <div className="mt-2 text-[13px]">
                  <span className="text-muted">Durée estimée :</span> {durationFr(p.durationMin)}
                </div>
                <div className="mt-1 text-[13px]">
                  <span className="text-muted">Toujours :</span> {p.items.map((i) => `${i.qty} × ${catalogByCode[i.code].label}`).join(', ')}
                </div>
                {p.optional.length > 0 && (
                  <div className="mt-1 text-[13px]">
                    <span className="text-muted">Selon diagnostic :</span> {p.optional.map((i) => `${i.qty} × ${catalogByCode[i.code].label}`).join(', ')}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="majorations" className="pt-4">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-left text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Majoration</th>
                  <th className="px-3 py-2.5 font-semibold">Créneau</th>
                  <th className="px-3 py-2.5 font-semibold">S’applique à</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Taux</th>
                </tr>
              </thead>
              <tbody>
                {SURCHARGES.map((s) => (
                  <tr key={s.key} className="border-t border-border">
                    <td className="px-4 py-2.5 font-semibold">{s.label}</td>
                    <td className="px-3 py-2.5">{s.window}</td>
                    <td className="px-3 py-2.5 text-muted">{s.appliesTo}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-accent tnum">+{s.percent} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-3 text-[13px] text-muted">Les majorations horaires ne se cumulent pas entre elles (la plus élevée s’applique) ; la majoration « urgence absolue » s’ajoute. Elles sont toujours affichées au client avant l’intervention.</p>
          </Card>
        </TabsContent>
        <TabsContent value="zones" className="pt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="aspect-[1000/680]">
                <CityMap
                  city={ds.company.city}
                  center={ds.company.center}
                  rounded={false}
                  markers={[{ id: 'home', at: ds.company.center, kind: 'home', title: 'Dépôt' }]}
                  heat={ds.company.postalCodes.map((cp) => {
                    const a = ds.clients.flatMap((c) => c.addresses).find((x) => x.postalCode === cp)
                    return { at: a?.location ?? ds.company.center, weight: zoneFor(ds.company, cp).zone === 1 ? 3 : 1 }
                  })}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Codes postaux desservis" subtitle="En production : dessin de la zone sur la carte ou liste de codes postaux." />
              <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                {ds.company.postalCodes.map((cp) => {
                  const z = zoneFor(ds.company, cp)
                  return (
                    <Badge key={cp} tone={z.zone === 1 ? 'accent' : 'info'}>
                      {cp} · zone {z.zone}
                    </Badge>
                  )
                })}
              </div>
              <div className="border-t border-border px-4 py-3 text-sm">
                <div>
                  Zone 1 (ville centre) : <b className="tnum">{money(Math.round(catalogByCode['DEP-Z1'].priceHtCents * 1.1))} TTC</b>
                </div>
                <div>
                  Zone 2 (agglomération) : <b className="tnum">{money(Math.round(catalogByCode['DEP-Z2'].priceHtCents * 1.1))} TTC</b>
                </div>
                <div className="mt-1 text-[13px] text-muted">Hors zone : refus poli ou proposition d’un partenaire.</div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Simulator() {
  const { ds } = useLookups()
  const problems = PROBLEM_TYPES.filter((p) => ds.company.trades.includes(p.trade))
  const [problem, setProblem] = React.useState(problems[0].code)
  const [urgency, setUrgency] = React.useState<Urgency>('absolue')
  const [complexity, setComplexity] = React.useState(problems[0].complexity)
  const [when, setWhen] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
    d.setHours(22, 30, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [cp, setCp] = React.useState(ds.company.postalCodes[1])
  const est = estimatePrice({
    company: ds.company,
    problemTypeCode: problem,
    complexity,
    urgency,
    at: new Date(when),
    address: { id: 'sim', line1: '', postalCode: cp, city: '', location: ds.company.center, housingType: 'appartement' },
  })
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Problème" htmlFor="sim-problem" className="sm:col-span-2">
            <Select
              id="sim-problem"
              value={problem}
              onChange={(e) => {
                setProblem(e.target.value)
                setComplexity(PROBLEM_TYPES.find((p) => p.code === e.target.value)!.complexity)
              }}
            >
              {problems.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Urgence" htmlFor="sim-urgency">
            <Select id="sim-urgency" value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
              {Object.entries(URGENCY).map(([k, u]) => (
                <option key={k} value={k}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Complexité" htmlFor="sim-complexity">
            <Select id="sim-complexity" value={complexity} onChange={(e) => setComplexity(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((c) => (
                <option key={c} value={c}>
                  {c} / 5
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date et heure d’intervention" htmlFor="sim-when">
            <Input id="sim-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label="Code postal" htmlFor="sim-cp" hint={zoneFor(ds.company, cp).label}>
            <Input id="sim-cp" inputMode="numeric" value={cp} onChange={(e) => setCp(e.target.value)} />
          </Field>
        </div>
        <p className="mt-4 text-[13px] text-muted">
          Le même calcul est exposé à l’agent IA par l’API (<span className="font-mono">GET /v1/pricing/estimate</span>) : l’IA n’invente jamais un prix, elle s’appuie sur votre grille.
        </p>
      </Card>
      <Card className="p-4">
        {est.outOfZone && <Badge tone="bad" className="mb-2">Hors zone d’intervention</Badge>}
        {est.surcharges.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {est.surcharges.map((s) => (
              <Badge key={s} tone="accent">
                {s}
              </Badge>
            ))}
          </div>
        )}
        <PriceBreakdown est={est} />
      </Card>
    </div>
  )
}
