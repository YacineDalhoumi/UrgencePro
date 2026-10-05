import * as React from 'react'
import { Link } from 'react-router-dom'
import { PhoneIncoming, Play, Pause, Bot, MessageSquare, Moon, Sun, Voicemail } from 'lucide-react'
import { useStore } from '@/store/store'
import { useLookups } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, Dialog } from '@/components/ui/primitives'
import { CallBadge, PageHeader } from '@/components/shared/bits'
import type { Call } from '@/data/types'
import { cn, dateTimeFr, n, percent, phone, MINUTE } from '@/lib/utils'

const TABS = [
  { key: 'tous', label: 'Tous' },
  { key: 'manque', label: 'Manqués' },
  { key: 'agent_ia', label: 'Agent IA' },
  { key: 'repondu', label: 'Répondus' },
]

export function CallsPage() {
  const { ds, clients } = useLookups()
  const simulateCall = useStore((s) => s.simulateCall)
  const incoming = useStore((s) => s.incoming)
  const [tab, setTab] = React.useState('tous')
  const [open, setOpen] = React.useState<Call | null>(null)
  const [limit, setLimit] = React.useState(40)
  const dayStart = new Date().setHours(0, 0, 0, 0)
  const today = ds.calls.filter((c) => c.at >= dayStart)
  const answered = today.filter((c) => c.status === 'repondu')
  const missed = today.filter((c) => c.status === 'manque' || c.status === 'messagerie')
  const rows = ds.calls.filter((c) => tab === 'tous' || c.status === tab || (tab === 'manque' && c.status === 'messagerie'))
  const hour = new Date().getHours()
  const night = hour >= 20 || hour < 8
  const onCall = ds.technicians.find((t) => t.onCall)

  return (
    <div>
      <PageHeader
        title="Appels"
        subtitle={`Standard 24 h/24 · ${phone(ds.company.phone)} (numéro virtuel Twilio)`}
        actions={
          <Button variant="primary" onClick={() => simulateCall(Math.random() < 0.6)} disabled={!!incoming}>
            <PhoneIncoming /> Simuler un appel entrant
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Appels aujourd’hui', n(today.length)],
          ['Taux de décroché', today.length ? percent(answered.length / today.length) : '—'],
          ['Manqués (rappel SMS auto)', n(missed.length)],
          ['Attente moyenne', answered.length ? `${Math.round(answered.reduce((a, c) => a + c.waitSec, 0) / answered.length)} s` : '—'],
        ].map(([l, v]) => (
          <Card key={l} className="p-4">
            <div className="label-caps text-muted">{l}</div>
            <div className="mt-1 font-display text-2xl font-extrabold tnum">{v}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-3">
        <CardHeader title="Routage actif en ce moment" subtitle="Paramètres → Téléphonie pour modifier les règles" />
        <div className="grid grid-cols-1 gap-3 px-4 pb-4 text-sm md:grid-cols-3">
          <div className="flex items-start gap-3 rounded border border-accent/40 bg-accent-soft/40 p-3">
            {night ? <Moon className="mt-0.5 size-5 text-accent" /> : <Sun className="mt-0.5 size-5 text-accent" />}
            <div>
              <div className="font-semibold">{night ? 'Règle « Nuit et week-end »' : 'Règle « Heures ouvrées »'}</div>
              <div className="text-muted">{night ? `Sonnerie : ${onCall?.firstName} (astreinte), puis agent vocal IA après 25 s` : `Sonnerie simultanée : secrétariat + ${onCall?.firstName} (astreinte)`}</div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded border border-border p-3">
            <Bot className="mt-0.5 size-5 text-ai" />
            <div>
              <div className="font-semibold">Si personne ne décroche</div>
              <div className="text-muted">Agent vocal IA (n8n) ou messagerie avec transcription, puis SMS avec lien photos.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded border border-border p-3">
            <Voicemail className="mt-0.5 size-5 text-muted" />
            <div>
              <div className="font-semibold">Accueil</div>
              <div className="text-muted">« {ds.company.name}, bonjour. Cet appel peut être enregistré pour la qualité du service. »</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="mb-3 mt-5 flex gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('h-8 rounded-full border px-3 text-[13px] font-semibold', tab === t.key ? 'border-ink bg-ink text-ink-fg' : 'border-border bg-surface text-muted hover:text-fg')}>
            {t.label}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-sunken text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Appelant</th>
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Issue</th>
                <th className="px-3 py-2.5 text-right font-semibold">Durée</th>
                <th className="px-3 py-2.5 font-semibold">Résumé</th>
                <th className="px-3 py-2.5 font-semibold">Demande</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((c) => {
                const cl = c.clientId ? clients.get(c.clientId) : undefined
                const req = c.requestId ? ds.requests.find((r) => r.id === c.requestId) : undefined
                return (
                  <tr key={c.id} className="cursor-pointer border-t border-border hover:bg-sunken/60" onClick={() => setOpen(c)}>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{cl ? `${cl.firstName} ${cl.lastName}` : 'Numéro inconnu'}</div>
                      <div className="text-[12px] text-muted tnum">{phone(c.from)}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tnum">{dateTimeFr(c.at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <CallBadge s={c.status} />
                        {c.missedSmsSent && <span className="text-[11px] text-muted">SMS de rappel envoyé</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tnum">{c.durationSec ? `${Math.floor(c.durationSec / 60)} min ${String(c.durationSec % 60).padStart(2, '0')}` : '—'}</td>
                    <td className="max-w-[300px] px-3 py-2.5 text-[13px] text-muted">
                      <span className="line-clamp-2">{c.aiSummary ?? (c.requestId ? '' : 'Appel sans suite (renseignement, erreur de numéro)')}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {req ? (
                        <Link to={`/demandes/${req.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[13px] text-accent hover:underline">
                          {req.ref}
                        </Link>
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
        {rows.length > limit && (
          <div className="border-t border-border p-3 text-center">
            <Button size="sm" onClick={() => setLimit((l) => l + 40)}>
              Afficher plus ({rows.length - limit} restants)
            </Button>
          </div>
        )}
      </Card>
      <CallDialog call={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function CallDialog({ call, onClose }: { call: Call | null; onClose: () => void }) {
  const { clients } = useLookups()
  const [playing, setPlaying] = React.useState(false)
  const [pos, setPos] = React.useState(0)
  React.useEffect(() => {
    if (!playing || !call) return
    const t = setInterval(() => setPos((p) => (p >= 1 ? (setPlaying(false), 1) : p + 1 / Math.max(10, call.durationSec))), 1000)
    return () => clearInterval(t)
  }, [playing, call])
  React.useEffect(() => {
    setPos(0)
    setPlaying(false)
  }, [call])
  if (!call) return null
  const cl = call.clientId ? clients.get(call.clientId) : undefined
  const bars = Array.from({ length: 64 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.33)) * 0.75)
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={cl ? `${cl.firstName} ${cl.lastName}` : phone(call.from)} description={`${dateTimeFr(call.at)} · attente ${call.waitSec} s${call.answeredBy ? ` · décroché par ${call.answeredBy}` : ''}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <CallBadge s={call.status} />
          {call.recording && <Badge>Enregistré avec information préalable</Badge>}
        </div>
        {call.recording && call.durationSec > 0 && (
          <div className="flex items-center gap-3 rounded border border-border bg-sunken p-3">
            <Button size="icon" variant="ink" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Écouter'}>
              {playing ? <Pause /> : <Play />}
            </Button>
            <div className="flex h-10 flex-1 items-center gap-[2px]" aria-hidden>
              {bars.map((h, i) => (
                <span key={i} className={cn('flex-1 rounded-sm', i / bars.length <= pos ? 'bg-accent' : 'bg-border')} style={{ height: `${h * 100}%` }} />
              ))}
            </div>
            <span className="text-[12px] text-muted tnum">
              {Math.floor((pos * call.durationSec) / 60)}:{String(Math.floor((pos * call.durationSec) % 60)).padStart(2, '0')} / {Math.floor(call.durationSec / 60)}:{String(call.durationSec % 60).padStart(2, '0')}
            </span>
          </div>
        )}
        {call.aiSummary && (
          <div className="rounded border border-ai/30 bg-ai-soft/40 p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-ai">
              <Bot className="size-4" /> Résumé par l’agent IA
            </div>
            {call.aiSummary}
          </div>
        )}
        {call.transcript ? (
          <div>
            <div className="label-caps mb-1.5 text-muted">Transcription</div>
            <div className="space-y-1.5 rounded border border-border p-3 text-sm">
              {call.transcript.split('\n').map((l, i) => {
                const [who, ...rest] = l.split(' : ')
                return (
                  <p key={i}>
                    <b className={who === 'Client' ? 'text-accent' : ''}>{who} :</b> {rest.join(' : ')}
                  </p>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">{call.status === 'manque' ? 'Appel non décroché : pas d’enregistrement. Un SMS avec le lien de description a été envoyé.' : 'Transcription non disponible pour cet appel.'}</p>
        )}
        {call.missedSmsSent && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MessageSquare className="size-4" /> SMS de rappel envoyé {dateTimeFr(call.at + MINUTE)}
          </p>
        )}
        {call.requestId && (
          <Link to={`/demandes/${call.requestId}`} onClick={onClose} className="inline-block font-semibold text-accent hover:underline">
            Ouvrir la demande associée →
          </Link>
        )}
      </div>
    </Dialog>
  )
}
