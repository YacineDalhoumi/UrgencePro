import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Phone, Mail, MapPin, Download, UserX, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useLookups } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, Dialog, Empty, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives'
import { InvoiceBadge, PageHeader, QuoteBadge, RequestBadge } from '@/components/shared/bits'
import { MediaArt } from '@/components/shared/MediaArt'
import { CLIENT_TYPE, HOUSING_LABEL, problemByCode } from '@/data/reference'
import { totals } from '@/data/pricing'
import type { ClientType } from '@/data/types'
import { cn, copyText, dateFr, dateTimeFr, money, money0, n, phone } from '@/lib/utils'

export function ClientsPage() {
  const { ds } = useLookups()
  const [type, setType] = React.useState<'' | ClientType>('')
  const [q, setQ] = React.useState('')
  const [limit, setLimit] = React.useState(30)
  const stats = React.useMemo(() => {
    const m = new Map<string, { count: number; ca: number; last: number }>()
    for (const r of ds.requests) {
      const s = m.get(r.clientId) ?? { count: 0, ca: 0, last: 0 }
      s.count++
      s.last = Math.max(s.last, r.createdAt)
      m.set(r.clientId, s)
    }
    for (const i of ds.invoices) {
      const s = m.get(i.clientId)
      if (s) s.ca += totals(i.lines).ttc
    }
    return m
  }, [ds.requests, ds.invoices])
  const rows = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    return ds.clients
      .filter((c) => (!type || c.type === type) && (!t || `${c.firstName} ${c.lastName} ${c.companyName ?? ''} ${c.phone.replace('+33', '0')} ${c.addresses[0]?.city}`.toLowerCase().includes(t)))
      .sort((a, b) => (stats.get(b.id)?.last ?? 0) - (stats.get(a.id)?.last ?? 0))
  }, [ds.clients, type, q, stats])

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${n(ds.clients.length)} clients · particuliers, professionnels et donneurs d’ordre`} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Select id="client-type" aria-label="Type de client" value={type} onChange={(e) => setType(e.target.value as ClientType | '')} className="h-9 w-52">
          <option value="">Tous les types</option>
          {Object.entries(CLIENT_TYPE).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Input id="client-q" placeholder="Nom, téléphone, ville…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64" />
      </div>
      <Card className="overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-sunken text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-3 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 font-semibold">Téléphone</th>
                <th className="px-3 py-2.5 font-semibold">Ville</th>
                <th className="px-3 py-2.5 text-right font-semibold">Demandes</th>
                <th className="px-3 py-2.5 text-right font-semibold">CA TTC</th>
                <th className="px-3 py-2.5 font-semibold">Dernier contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((c) => {
                const s = stats.get(c.id)
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-sunken/60">
                    <td className="px-4 py-2.5">
                      <Link to={`/clients/${c.id}`} className="font-semibold hover:text-accent hover:underline">
                        {c.companyName ?? `${c.firstName} ${c.lastName}`}
                      </Link>
                      {c.companyName && <div className="text-[12px] text-muted">{c.firstName} {c.lastName}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={c.type === 'particulier' ? 'neutral' : 'info'}>{CLIENT_TYPE[c.type]}</Badge>
                    </td>
                    <td className="px-3 py-2.5 tnum">{phone(c.phone)}</td>
                    <td className="px-3 py-2.5">{c.addresses[0]?.city}</td>
                    <td className="px-3 py-2.5 text-right tnum">{s?.count ?? 0}</td>
                    <td className="px-3 py-2.5 text-right tnum">{s?.ca ? money0(s.ca) : '—'}</td>
                    <td className="px-3 py-2.5 text-muted">{s?.last ? dateFr(s.last) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="border-t border-border p-3 text-center">
            <Button size="sm" onClick={() => setLimit((l) => l + 30)}>
              Afficher plus ({rows.length - limit} restants)
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

export function ClientDetailPage() {
  const { id } = useParams()
  const { ds } = useLookups()
  const c = ds.clients.find((x) => x.id === id)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [anonymize, setAnonymize] = React.useState(false)
  if (!c) return <Empty title="Client introuvable" action={<Link to="/clients" className="text-accent underline">Retour</Link>} />
  const reqs = ds.requests.filter((r) => r.clientId === c.id)
  const quotes = ds.quotes.filter((q) => q.clientId === c.id)
  const invoices = ds.invoices.filter((i) => i.clientId === c.id)
  const sms = ds.sms.filter((s) => s.clientId === c.id)
  const media = reqs.flatMap((r) => r.media)
  const ca = invoices.reduce((a, i) => a + totals(i.lines).ttc, 0)
  const exportJson = JSON.stringify({ client: { ...c }, demandes: reqs.map((r) => ({ ref: r.ref, statut: r.status, creee: new Date(r.createdAt).toISOString() })), factures: invoices.map((i) => ({ ref: i.ref, ttc: totals(i.lines).ttc / 100 })), sms: sms.length }, null, 2)

  return (
    <div>
      <Link to="/clients" className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-fg">
        <ChevronLeft className="size-4" /> Clients
      </Link>
      <PageHeader
        title={c.companyName ?? `${c.firstName} ${c.lastName}`}
        subtitle={`${CLIENT_TYPE[c.type]} · client depuis ${dateFr(c.createdAt, 'MMMM yyyy')}`}
        actions={
          <>
            <Button onClick={() => setExportOpen(true)}>
              <Download /> Exporter ses données
            </Button>
            <Button variant="ghost" onClick={() => setAnonymize(true)}>
              <UserX /> Anonymiser
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Card className="p-4 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Demandes', n(reqs.length)],
                ['CA TTC', money0(ca)],
                ['Avis', n(ds.reviews.filter((r) => r.clientId === c.id).length)],
              ].map(([l, v]) => (
                <div key={l} className="rounded bg-sunken p-2">
                  <div className="font-display text-lg font-bold tnum">{v}</div>
                  <div className="text-[12px] text-muted">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {c.companyName && (
                <div>
                  Contact : <b>{c.firstName} {c.lastName}</b>
                </div>
              )}
              <div className="flex items-center gap-2 tnum">
                <Phone className="size-4 text-muted" /> {phone(c.phone)}
              </div>
              {c.email && (
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted" /> <span className="truncate">{c.email}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
                {c.smsOptOut && <Badge tone="bad">STOP SMS</Badge>}
              </div>
              {c.notes && <p className="rounded bg-sunken p-2.5 text-[13px]">{c.notes}</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Adresses" />
            <ul className="space-y-3 px-4 pb-4 text-sm">
              {c.addresses.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div>
                    <div className="font-semibold">
                      {a.line1}, {a.postalCode} {a.city}
                    </div>
                    <div className="text-[13px] text-muted">
                      {HOUSING_LABEL[a.housingType]}
                      {a.floor && ` · ${a.floor}`}
                      {a.doorCode && ` · code ${a.doorCode}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4 text-[13px] text-muted">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-fg">
              <ShieldCheck className="size-4 text-ok" /> RGPD
            </div>
            Consentement SMS transactionnels : oui · Prospection : {c.tags.includes('donneur d’ordre') ? 'non applicable' : 'non'} · Conservation : 3 ans après le dernier contact (pièces comptables : 10 ans).
          </Card>
        </div>
        <Card className="min-w-0 xl:col-span-2">
          <Tabs defaultValue="demandes" className="px-4 pb-4 pt-2">
            <TabsList>
              <TabsTrigger value="demandes">Demandes ({reqs.length})</TabsTrigger>
              <TabsTrigger value="devis">Devis ({quotes.length})</TabsTrigger>
              <TabsTrigger value="factures">Factures ({invoices.length})</TabsTrigger>
              <TabsTrigger value="sms">SMS ({sms.length})</TabsTrigger>
              <TabsTrigger value="photos">Photos ({media.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="demandes" className="pt-3">
              <List items={reqs.map((r) => ({ key: r.id, to: `/demandes/${r.id}`, title: problemByCode[r.problemTypeCode]?.label, sub: `${r.ref} · ${dateTimeFr(r.createdAt)}`, right: <RequestBadge s={r.status} /> }))} />
            </TabsContent>
            <TabsContent value="devis" className="pt-3">
              <List items={quotes.map((q) => ({ key: q.id, to: `/devis/${q.id}`, title: q.ref, sub: `${money(totals(q.lines).ttc)} TTC · ${dateFr(q.createdAt)}`, right: <QuoteBadge s={q.status} /> }))} />
            </TabsContent>
            <TabsContent value="factures" className="pt-3">
              <List items={invoices.map((i) => ({ key: i.id, to: `/factures?f=${i.id}`, title: i.ref, sub: `${money(totals(i.lines).ttc)} TTC · ${dateFr(i.issuedAt)}`, right: <InvoiceBadge s={i.status} /> }))} />
            </TabsContent>
            <TabsContent value="sms" className="pt-3">
              <div className="space-y-2">
                {sms.slice(-30).map((s) => (
                  <div key={s.id} className={cn('flex', s.direction === 'sortant' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[80%] rounded-lg px-3 py-2 text-[13px]', s.direction === 'sortant' ? 'bg-ink text-ink-fg' : 'border border-border bg-sunken')}>
                      {s.body}
                      <div className="mt-0.5 text-[11px] opacity-60">{dateTimeFr(s.at)}</div>
                    </div>
                  </div>
                ))}
                {!sms.length && <p className="py-6 text-center text-sm text-muted">Aucun SMS.</p>}
              </div>
            </TabsContent>
            <TabsContent value="photos" className="pt-3">
              {media.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {media.map((m) => (
                    <div key={m.id} className="aspect-[10/9] overflow-hidden rounded border border-border">
                      <MediaArt media={m} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted">Aucune photo.</p>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      <Dialog open={exportOpen} onOpenChange={setExportOpen} title="Export des données du client" description="Droit d’accès et de portabilité (RGPD, art. 15 et 20). Format JSON." wide>
        <pre className="max-h-80 overflow-auto rounded bg-sunken p-3 font-mono text-[12px]">{exportJson}</pre>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" onClick={async () => {
              if (await copyText(exportJson)) toast.success('Export copié')
              else toast('Sélectionnez le texte pour le copier')
            }}>
            Copier l’export
          </Button>
        </div>
      </Dialog>
      <Dialog open={anonymize} onOpenChange={setAnonymize} title="Anonymiser ce client ?" description="Droit à l’effacement. Nom, téléphone, e-mail, adresses et photos sont supprimés. Les factures sont conservées 10 ans (obligation comptable) sous forme anonymisée.">
        <div className="flex justify-end gap-2">
          <Button onClick={() => setAnonymize(false)}>Annuler</Button>
          <Button
            variant="danger"
            onClick={() => {
              setAnonymize(false)
              toast.success('Demande d’anonymisation enregistrée', { description: 'Dans la démo, les données restent visibles.' })
            }}
          >
            Anonymiser
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function List({ items }: { items: { key: string; to: string; title?: string; sub: string; right: React.ReactNode }[] }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">Rien pour l’instant.</p>
  return (
    <ul className="divide-y divide-border">
      {items.map((it) => (
        <li key={it.key}>
          <Link to={it.to} className="flex items-center justify-between gap-3 py-2.5 hover:text-accent">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{it.title}</span>
              <span className="text-[12px] text-muted">{it.sub}</span>
            </span>
            {it.right}
          </Link>
        </li>
      ))}
    </ul>
  )
}
