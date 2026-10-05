import * as React from 'react'
import { Link } from 'react-router-dom'
import { useLookups } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/primitives'
import { AiBadge, PageHeader, QuoteBadge } from '@/components/shared/bits'
import { totals } from '@/data/pricing'
import type { QuoteStatus } from '@/data/types'
import { cn, dateTimeFr, money, money0, n } from '@/lib/utils'

const TABS: { key: string; label: string; match: (s: QuoteStatus) => boolean }[] = [
  { key: 'attente', label: 'En attente de signature', match: (s) => s === 'envoye' || s === 'consulte' },
  { key: 'brouillon', label: 'Brouillons', match: (s) => s === 'brouillon' },
  { key: 'signe', label: 'Signés', match: (s) => s === 'signe' },
  { key: 'perdu', label: 'Refusés / expirés', match: (s) => s === 'refuse' || s === 'expire' },
  { key: 'tous', label: 'Tous', match: () => true },
]

export function QuotesPage() {
  const { ds, clients } = useLookups()
  const [tab, setTab] = React.useState('attente')
  const [limit, setLimit] = React.useState(30)
  const rows = ds.quotes.filter((q) => TABS.find((t) => t.key === tab)!.match(q.status)).sort((a, b) => (b.sentAt ?? b.createdAt) - (a.sentAt ?? a.createdAt))
  const pending = ds.quotes.filter((q) => q.status === 'envoye' || q.status === 'consulte')
  const decided = ds.quotes.filter((q) => ['signe', 'refuse', 'expire'].includes(q.status))
  return (
    <div>
      <PageHeader title="Devis" subtitle="Générés depuis la qualification, signés en ligne ou sur la tablette du technicien." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['En attente', n(pending.length)],
          ['Montant en attente TTC', money0(pending.reduce((a, q) => a + totals(q.lines).ttc, 0))],
          ['Taux d’acceptation', `${Math.round((decided.filter((q) => q.status === 'signe').length / Math.max(1, decided.length)) * 100)} %`],
          ['Relances automatiques', 'J+1 · J+3 · J+7'],
        ].map(([l, v]) => (
          <Card key={l} className="p-4">
            <div className="label-caps text-muted">{l}</div>
            <div className="mt-1 font-display text-xl font-extrabold tnum">{v}</div>
          </Card>
        ))}
      </div>
      <div className="scroll-thin mb-3 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('h-8 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold', tab === t.key ? 'border-ink bg-ink text-ink-fg' : 'border-border bg-surface text-muted hover:text-fg')}>
            {t.label}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-sunken text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Devis</th>
                <th className="px-3 py-2.5 font-semibold">Client</th>
                <th className="px-3 py-2.5 text-right font-semibold">Montant TTC</th>
                <th className="px-3 py-2.5 font-semibold">Statut</th>
                <th className="px-3 py-2.5 font-semibold">Envoi / suivi</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((q) => {
                const c = clients.get(q.clientId)
                return (
                  <tr key={q.id} className="border-t border-border hover:bg-sunken/60">
                    <td className="px-4 py-2.5">
                      <Link to={`/devis/${q.id}`} className="font-mono text-[13px] font-medium text-accent hover:underline">
                        {q.ref}
                      </Link>
                      {q.aiDraft && <AiBadge className="ml-2" label="Brouillon IA" />}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{c?.companyName ?? `${c?.firstName} ${c?.lastName}`}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tnum">{money(totals(q.lines).ttc)}</td>
                    <td className="px-3 py-2.5">
                      <QuoteBadge s={q.status} />
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-muted">
                      {q.signedAt ? `Signé ${dateTimeFr(q.signedAt)}` : q.viewedAt ? `Consulté ${dateTimeFr(q.viewedAt)}` : q.sentAt ? `Envoyé ${dateTimeFr(q.sentAt)}` : `Créé ${dateTimeFr(q.createdAt)}`}
                      {q.reminders.length > 0 && !q.signedAt && ` · ${q.reminders.length} relance${q.reminders.length > 1 ? 's' : ''}`}
                    </td>
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
