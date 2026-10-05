import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/store'
import { useLookups, addressOf } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Card, Dialog } from '@/components/ui/primitives'
import { InvoiceBadge, PageHeader } from '@/components/shared/bits'
import { CsvExport } from '@/components/shared/CsvDialog'
import { DocumentView } from '@/components/shared/DocumentView'
import { totals } from '@/data/pricing'
import { PAYMENT_METHOD } from '@/data/reference'
import type { InvoiceStatus, PaymentMethod } from '@/data/types'
import { toCsv } from '@/lib/stats'
import { cn, dateFr, money, money0, n } from '@/lib/utils'

const TABS: { key: string; label: string; match: (s: InvoiceStatus) => boolean }[] = [
  { key: 'impayees', label: 'À encaisser', match: (s) => s === 'emise' || s === 'en_retard' || s === 'partielle' },
  { key: 'retard', label: 'En retard', match: (s) => s === 'en_retard' },
  { key: 'payees', label: 'Payées', match: (s) => s === 'payee' },
  { key: 'toutes', label: 'Toutes', match: () => true },
]

export function InvoicesPage() {
  const { ds, clients } = useLookups()
  const recordPayment = useStore((s) => s.recordPayment)
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = React.useState('impayees')
  const [limit, setLimit] = React.useState(30)
  const selectedId = params.get('f')
  const selected = selectedId ? ds.invoices.find((i) => i.id === selectedId) : undefined
  const rows = ds.invoices.filter((i) => TABS.find((t) => t.key === tab)!.match(i.status))
  const unpaid = ds.invoices.filter((i) => i.status !== 'payee')
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const month = ds.invoices.filter((i) => i.issuedAt >= monthStart)

  const fec = () =>
    toCsv([
      ['JournalCode', 'EcritureDate', 'PieceRef', 'CompteNum', 'CompteLib', 'Debit', 'Credit'],
      ...ds.invoices.slice(0, 60).flatMap((i) => {
        const t = totals(i.lines)
        const d = dateFr(i.issuedAt, 'yyyyMMdd')
        return [
          ['VE', d, i.ref, '411000', 'Clients', (t.ttc / 100).toFixed(2).replace('.', ','), '0,00'],
          ['VE', d, i.ref, '706000', 'Prestations de services', '0,00', (t.ht / 100).toFixed(2).replace('.', ',')],
          ['VE', d, i.ref, '445710', 'TVA collectée', '0,00', (t.vat / 100).toFixed(2).replace('.', ',')],
        ]
      }),
    ])

  return (
    <div>
      <PageHeader
        title="Factures"
        subtitle="Numérotation continue, factures verrouillées à l’émission, corrections par avoir."
        actions={<CsvExport filename="export-comptable-FEC.csv" build={fec} label="Export comptable (FEC)" />}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Facturé ce mois TTC', money0(month.reduce((a, i) => a + totals(i.lines).ttc, 0))],
          ['Reste à encaisser', money0(unpaid.reduce((a, i) => a + totals(i.lines).ttc - i.payments.reduce((x, p) => x + p.amountCents, 0), 0))],
          ['Factures en retard', n(ds.invoices.filter((i) => i.status === 'en_retard').length)],
          ['Payées sur place', `${Math.round((ds.invoices.filter((i) => i.payments.some((p) => p.at - i.issuedAt < 3600_000)).length / Math.max(1, ds.invoices.length)) * 100)} %`],
        ].map(([l, v]) => (
          <Card key={l} className="p-4">
            <div className="label-caps text-muted">{l}</div>
            <div className="mt-1 font-display text-xl font-extrabold tnum">{v}</div>
          </Card>
        ))}
      </div>
      <div className="mb-3 flex gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('h-8 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold', tab === t.key ? 'border-ink bg-ink text-ink-fg' : 'border-border bg-surface text-muted hover:text-fg')}>
            {t.label}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-sunken text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Facture</th>
                <th className="px-3 py-2.5 font-semibold">Client</th>
                <th className="px-3 py-2.5 text-right font-semibold">Montant TTC</th>
                <th className="px-3 py-2.5 font-semibold">Statut</th>
                <th className="px-3 py-2.5 font-semibold">Émise / échéance</th>
                <th className="px-3 py-2.5 font-semibold">Règlement</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((i) => {
                const c = clients.get(i.clientId)
                return (
                  <tr key={i.id} className="cursor-pointer border-t border-border hover:bg-sunken/60" onClick={() => setParams({ f: i.id })}>
                    <td className="px-4 py-2.5 font-mono text-[13px] font-medium text-accent">{i.ref}</td>
                    <td className="px-3 py-2.5 font-semibold">{c?.companyName ?? `${c?.firstName} ${c?.lastName}`}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tnum">{money(totals(i.lines).ttc)}</td>
                    <td className="px-3 py-2.5">
                      <InvoiceBadge s={i.status} />
                    </td>
                    <td className="px-3 py-2.5 text-[13px] tnum">
                      {dateFr(i.issuedAt, 'dd/MM/yyyy')} <span className="text-muted">→ {dateFr(i.dueAt, 'dd/MM/yyyy')}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-muted">{i.payments.length ? PAYMENT_METHOD[i.payments[0].method] : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="border-t border-border p-3 text-center">
            <Button size="sm" onClick={() => setLimit((l) => l + 30)}>
              Afficher plus ({rows.length - limit} restantes)
            </Button>
          </div>
        )}
      </Card>
      <Dialog open={!!selected} onOpenChange={(v) => !v && setParams({})} title={selected ? `Facture ${selected.ref}` : ''} description={selected ? `${money(totals(selected.lines).ttc)} TTC` : undefined} wide>
        {selected && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <InvoiceBadge s={selected.status} />
              <Link to={`/demandes/${selected.requestId}`} className="text-[13px] font-semibold text-accent hover:underline">
                Demande liée
              </Link>
              {selected.status !== 'payee' && (
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => toast.success('Relance envoyée par SMS et e-mail', { description: 'Avec le lien de paiement en ligne.' })}>
                    <BellRing /> Relancer
                  </Button>
                  {(['cb_en_ligne', 'virement', 'cheque'] as PaymentMethod[]).map((m) => (
                    <Button key={m} size="sm" variant={m === 'cb_en_ligne' ? 'ok' : 'secondary'} onClick={() => recordPayment(selected.id, m)}>
                      {PAYMENT_METHOD[m]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            {selected.payments.map((p) => (
              <p key={p.id} className="text-sm font-semibold text-ok">
                Payée le {dateFr(p.at, 'dd/MM/yyyy à HH:mm')} · {PAYMENT_METHOD[p.method]} · {money(p.amountCents)}
              </p>
            ))}
            {(() => {
              const req = ds.requests.find((r) => r.id === selected.requestId)
              const client = clients.get(selected.clientId)!
              return <DocumentView kind="facture" refNo={selected.ref} company={ds.company} client={client} address={req ? addressOf(ds, req.clientId, req.addressId) : undefined} lines={selected.lines} issuedAt={selected.issuedAt} dueAt={selected.dueAt} compact />
            })()}
          </div>
        )}
      </Dialog>
    </div>
  )
}
