import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneIncoming, PhoneOff, Phone, History } from 'lucide-react'
import { useStore } from '@/store/store'
import { useDs } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/primitives'
import { problemByCode } from '@/data/reference'
import { dateFr, money0, phone } from '@/lib/utils'
import { totals } from '@/data/pricing'

/** Fiche d'appel entrant : identification de l'appelant et historique, avant même de décrocher. */
export function IncomingCallCard() {
  const incoming = useStore((s) => s.incoming)
  const answer = useStore((s) => s.answerCall)
  const miss = useStore((s) => s.missCall)
  const ds = useDs()
  const navigate = useNavigate()
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    if (!incoming) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [incoming])

  if (!incoming) return null
  const client = incoming.clientId ? ds.clients.find((c) => c.id === incoming.clientId) : undefined
  const history = client ? ds.requests.filter((r) => r.clientId === client.id && r.invoiceId) : []
  const spent = history.reduce((a, r) => {
    const inv = ds.invoices.find((i) => i.id === r.invoiceId)
    return a + (inv ? totals(inv.lines).ttc : 0)
  }, 0)
  const last = history[0]

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl" role="alertdialog" aria-label="Appel entrant">
      <div className="flex items-center gap-3 bg-ink px-4 py-3 text-ink-fg">
        <span className="ringing inline-flex size-10 items-center justify-center rounded-full bg-accent text-accent-fg">
          <PhoneIncoming className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="label-caps text-ink-fg/60">Appel entrant · {elapsed} s</div>
          <div className="truncate font-display text-lg font-bold tnum">{client ? `${client.firstName} ${client.lastName}` : phone(incoming.phone)}</div>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">
        {client ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ok">Client connu</Badge>
              <span className="text-muted tnum">{phone(client.phone)}</span>
            </div>
            <div className="flex items-start gap-2 rounded bg-sunken p-2.5">
              <History className="mt-0.5 size-4 shrink-0 text-muted" />
              <div>
                <div className="font-semibold">
                  {history.length} intervention{history.length > 1 ? 's' : ''} · {money0(spent)} facturés
                </div>
                {last && (
                  <div className="text-[13px] text-muted">
                    Dernière : {problemByCode[last.problemTypeCode]?.label} le {dateFr(last.createdAt)}
                  </div>
                )}
                <div className="text-[13px] text-muted">{client.addresses[0].line1}, {client.addresses[0].city}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Nouveau numéro</Badge>
            <span className="text-muted">Aucun historique</span>
          </div>
        )}
        <p className="text-[13px] text-muted">Sonnerie simultanée : Sandrine, {ds.technicians.find((t) => t.onCall)?.firstName} (astreinte). Sans réponse après 25 s, l’appel bascule vers l’agent vocal IA.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ok"
            size="lg"
            onClick={() => {
              const id = answer()
              if (id) navigate(`/demandes/${id}`)
            }}
          >
            <Phone /> Décrocher
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              const id = miss()
              if (id) navigate(`/demandes/${id}`)
            }}
          >
            <PhoneOff /> Manquer
          </Button>
        </div>
      </div>
    </div>
  )
}
