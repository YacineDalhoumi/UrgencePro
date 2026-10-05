import * as React from 'react'
import { Plus, Copy, RotateCw, Send, KeyRound, Trash2, Radio } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/store'
import { useLookups } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, Dialog, Field, Input, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives'
import { PageHeader } from '@/components/shared/bits'
import { API_SCOPES, WEBHOOK_EVENTS } from '@/data/reference'
import type { WebhookDelivery } from '@/data/types'
import { cn, copyText, dateTimeFr, ago } from '@/lib/utils'

export function IntegrationsPage() {
  return (
    <div>
      <PageHeader title="API et webhooks" subtitle="Connectez vos agents IA n8n : ils lisent et écrivent via l’API REST, et réagissent aux événements." />
      <Tabs defaultValue="evenements">
        <TabsList>
          <TabsTrigger value="evenements">Événements en direct</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks sortants</TabsTrigger>
          <TabsTrigger value="cles">Clés API</TabsTrigger>
          <TabsTrigger value="doc">Documentation</TabsTrigger>
        </TabsList>
        <TabsContent value="evenements" className="pt-4">
          <EventsTab />
        </TabsContent>
        <TabsContent value="webhooks" className="pt-4">
          <WebhooksTab />
        </TabsContent>
        <TabsContent value="cles" className="pt-4">
          <KeysTab />
        </TabsContent>
        <TabsContent value="doc" className="pt-4">
          <DocTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EventsTab() {
  const { ds } = useLookups()
  return (
    <Card>
      <CardHeader
        title="Flux d’événements"
        subtitle="Faites une action dans la démo (appel simulé, bouton « En route », signature…) et regardez l’événement arriver."
        action={
          <Badge tone="ok">
            <Radio className="size-3.5" /> En direct
          </Badge>
        }
      />
      <div className="scroll-thin max-h-[560px] overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {ds.events.slice(0, 80).map((e) => {
              const deliveries = ds.deliveries.filter((d) => d.eventId === e.id)
              return (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-[12px] text-muted tnum">{dateTimeFr(e.at)}</td>
                  <td className="px-3 py-2">
                    <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-accent">{e.type}</code>
                  </td>
                  <td className="min-w-[220px] px-3 py-2">
                    {e.summary}
                    <div className="text-[12px] text-muted">par {e.actor}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {deliveries.length ? (
                      deliveries.map((d) => (
                        <Badge key={d.id} tone={d.status === 'succes' ? 'ok' : 'bad'} className="ml-1">
                          {d.httpStatus}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[12px] text-muted">aucun abonné</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function WebhooksTab() {
  const { ds } = useLookups()
  const toggle = useStore((s) => s.toggleWebhook)
  const test = useStore((s) => s.testWebhook)
  const replay = useStore((s) => s.replayDelivery)
  const [adding, setAdding] = React.useState(false)
  const [detail, setDetail] = React.useState<WebhookDelivery | null>(null)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {ds.webhooks.map((w) => {
          const dl = ds.deliveries.filter((d) => d.endpointId === w.id)
          const fails = dl.filter((d) => d.status === 'echec').length
          return (
            <Card key={w.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{w.description}</div>
                  <div className="truncate font-mono text-[12px] text-muted" title={w.url}>
                    {w.url}
                  </div>
                </div>
                <Switch id={`wh-${w.id}`} checked={w.active} onCheckedChange={() => toggle(w.id)} label="Actif" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {w.events.map((e) => (
                  <code key={e} className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[11px]">
                    {e}
                  </code>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[12px] text-muted">
                <span>
                  Secret <span className="font-mono">{w.secretPreview}</span> · {dl.length} envois{fails ? ` · ${fails} échec${fails > 1 ? 's' : ''}` : ''}
                </span>
                <Button size="sm" onClick={() => test(w.id)}>
                  <Send /> Tester
                </Button>
              </div>
            </Card>
          )
        })}
        <button onClick={() => setAdding(true)} className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border text-sm font-semibold text-muted hover:border-accent hover:text-accent">
          <Plus className="size-5" /> Ajouter un webhook
        </button>
      </div>
      <Card className="overflow-hidden">
        <CardHeader title="Historique des envois" subtitle="Nouvelle tentative automatique : 1 min, 5 min, 30 min, 2 h, 6 h, 24 h. Rejeu manuel possible." />
        <div className="scroll-thin max-h-[420px] overflow-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="sticky top-0 bg-sunken text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Événement</th>
                <th className="px-3 py-2 font-semibold">Destination</th>
                <th className="px-3 py-2 font-semibold">Réponse</th>
                <th className="px-3 py-2 text-right font-semibold">Durée</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {ds.deliveries.slice(0, 60).map((d) => (
                <tr key={d.id} className="cursor-pointer border-t border-border hover:bg-sunken/60" onClick={() => setDetail(d)}>
                  <td className="whitespace-nowrap px-4 py-2 text-[12px] text-muted tnum">{dateTimeFr(d.at)}</td>
                  <td className="px-3 py-2 font-mono text-[12px]">{d.eventType}</td>
                  <td className="px-3 py-2 text-[13px]">{ds.webhooks.find((w) => w.id === d.endpointId)?.description}</td>
                  <td className="px-3 py-2">
                    <Badge tone={d.status === 'succes' ? 'ok' : 'bad'}>
                      {d.httpStatus} {d.status === 'succes' ? 'OK' : 'échec'}
                    </Badge>
                    {d.attempt > 1 && <span className="ml-1 text-[11px] text-muted">tentative {d.attempt}</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-[12px] tnum">{d.durationMs} ms</td>
                  <td className="px-3 py-2 text-right">
                    {d.status === 'echec' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          replay(d.id)
                        }}
                      >
                        <RotateCw /> Rejouer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <AddWebhookDialog open={adding} onOpenChange={setAdding} />
      <DeliveryDialog d={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

function DeliveryDialog({ d, onClose }: { d: WebhookDelivery | null; onClose: () => void }) {
  const { ds } = useLookups()
  if (!d) return null
  const e = ds.events.find((x) => x.id === d.eventId)
  const ts = Math.floor(d.at / 1000)
  const body = JSON.stringify(
    {
      id: d.eventId,
      type: d.eventType,
      api_version: '2026-10-01',
      created_at: new Date(e?.at ?? d.at).toISOString(),
      company_id: ds.company.id,
      data: { object: { id: e?.entityId ?? null, summary: e?.summary ?? 'Événement de test' } },
    },
    null,
    2,
  )
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={d.eventType} description={`Envoyé ${dateTimeFr(d.at)} · ${d.httpStatus} en ${d.durationMs} ms`} wide>
      <div className="label-caps mb-1 text-muted">En-têtes</div>
      <pre className="overflow-x-auto rounded bg-sunken p-3 font-mono text-[12px]">{`POST ${ds.webhooks.find((w) => w.id === d.endpointId)?.url}
Content-Type: application/json
X-UrgencePro-Event: ${d.eventType}
X-UrgencePro-Delivery: ${d.id}
X-UrgencePro-Signature: t=${ts},v1=5f2c9a1e…(HMAC-SHA256)`}</pre>
      <div className="label-caps mb-1 mt-3 text-muted">Corps</div>
      <pre className="overflow-x-auto rounded bg-sunken p-3 font-mono text-[12px]">{body}</pre>
    </Dialog>
  )
}

function AddWebhookDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const add = useStore((s) => s.addWebhook)
  const [url, setUrl] = React.useState('https://n8n.example.com/webhook/')
  const [desc, setDesc] = React.useState('')
  const [events, setEvents] = React.useState<string[]>(['request.created'])
  const valid = /^https:\/\/.+/.test(url) && events.length > 0
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Ajouter un webhook" description="Chaque envoi est signé (HMAC-SHA256) avec un secret propre à ce webhook." wide>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="URL (HTTPS)" htmlFor="wh-url">
          <Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono text-[13px]" />
        </Field>
        <Field label="Description" htmlFor="wh-desc">
          <Input id="wh-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Agent IA de relance" />
        </Field>
      </div>
      <div className="label-caps mb-2 mt-4 text-muted">Événements</div>
      <div className="flex flex-wrap gap-1.5">
        {WEBHOOK_EVENTS.map((e) => {
          const on = events.includes(e)
          return (
            <button key={e} onClick={() => setEvents(on ? events.filter((x) => x !== e) : [...events, e])} className={cn('rounded border px-2 py-1 font-mono text-[12px]', on ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg')}>
              {e}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => onOpenChange(false)}>Annuler</Button>
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => {
            add(url, desc || 'Nouveau webhook', events)
            onOpenChange(false)
          }}
        >
          Ajouter
        </Button>
      </div>
    </Dialog>
  )
}

function KeysTab() {
  const { ds } = useLookups()
  const create = useStore((s) => s.createApiKey)
  const revoke = useStore((s) => s.revokeApiKey)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [scopes, setScopes] = React.useState<string[]>(['requests:read', 'requests:write', 'ai:write'])
  const [secret, setSecret] = React.useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = React.useState<string | null>(null)
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setOpen(true)}>
          <KeyRound /> Créer une clé
        </Button>
      </div>
      {ds.apiKeys.map((k) => (
        <Card key={k.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{k.name}</div>
            <div className="font-mono text-[12px] text-muted">{k.prefix}••••••••••••</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {k.scopes.map((s) => (
                <code key={s} className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[11px]">
                  {s}
                </code>
              ))}
            </div>
          </div>
          <div className="text-right text-[12px] text-muted">
            <div>{k.lastUsedAt ? `Utilisée ${ago(k.lastUsedAt)}` : 'Jamais utilisée'}</div>
            <div>Limite : 120 requêtes / min</div>
          </div>
          {confirmRevoke === k.id ? (
            <div className="flex gap-1">
              <Button size="sm" variant="danger" onClick={() => revoke(k.id)}>
                Confirmer
              </Button>
              <Button size="sm" onClick={() => setConfirmRevoke(null)}>
                Annuler
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(k.id)}>
              <Trash2 /> Révoquer
            </Button>
          )}
        </Card>
      ))}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) {
            setSecret(null)
            setName('')
          }
        }}
        title={secret ? 'Clé créée' : 'Créer une clé API'}
        description={secret ? 'Copiez-la maintenant : elle ne sera plus jamais affichée (seule son empreinte est conservée).' : 'Donnez uniquement les permissions nécessaires à l’agent.'}
        wide
      >
        {secret ? (
          <div className="space-y-3">
            <pre className="overflow-x-auto rounded bg-sunken p-3 font-mono text-[13px]">{secret}</pre>
            <Button
              variant="primary"
              onClick={async () => {
                if (await copyText(secret)) toast.success('Clé copiée')
                else toast('Sélectionnez la clé pour la copier')
              }}
            >
              <Copy /> Copier la clé
            </Button>
          </div>
        ) : (
          <>
            <Field label="Nom" htmlFor="key-name">
              <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="n8n — agent relances" />
            </Field>
            <div className="label-caps mb-2 mt-4 text-muted">Permissions</div>
            <div className="flex flex-wrap gap-1.5">
              {API_SCOPES.map((s) => {
                const on = scopes.includes(s)
                return (
                  <button key={s} onClick={() => setScopes(on ? scopes.filter((x) => x !== s) : [...scopes, s])} className={cn('rounded border px-2 py-1 font-mono text-[12px]', on ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg')}>
                    {s}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="primary" disabled={!name.trim() || !scopes.length} onClick={() => setSecret(create(name.trim(), scopes))}>
                Créer la clé
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  )
}

const ENDPOINTS: [string, string, string, string][] = [
  ['GET', '/v1/requests', 'requests:read', 'Liste des demandes (filtres, pagination par curseur)'],
  ['POST', '/v1/requests', 'requests:write', 'Créer une demande'],
  ['POST', '/v1/requests/{id}/ai-qualification', 'ai:write', 'Proposer une qualification IA (validée par un humain)'],
  ['POST', '/v1/requests/{id}/status', 'requests:write', 'Changer le statut (cycle de vie contrôlé)'],
  ['POST', '/v1/requests/{id}/photo-request', 'sms:send', 'Envoyer le lien photos + localisation'],
  ['POST', '/v1/calls/{id}/ai-summary', 'ai:write', 'Résumé et transcription d’un appel'],
  ['GET', '/v1/pricing/estimate', 'requests:read', 'Fourchette de prix depuis la grille tarifaire'],
  ['GET', '/v1/schedule/availability', 'jobs:read', 'Créneaux et techniciens disponibles avec ETA'],
  ['POST', '/v1/quotes', 'quotes:write', 'Créer un devis brouillon'],
  ['POST', '/v1/quotes/{id}/send', 'quotes:write', 'Envoyer un devis (si l’automatisation l’autorise)'],
  ['POST', '/v1/sms', 'sms:send', 'Envoyer un SMS (STOP vérifié)'],
  ['GET', '/v1/invoices', 'invoices:read', 'Factures et paiements'],
  ['GET', '/v1/stats', 'stats:read', 'Indicateurs du tableau de bord'],
]

function DocTab() {
  const curl = `curl -X POST https://api.urgencepro.example/v1/requests/req_123/ai-qualification \\
  -H "Authorization: Bearer up_live_••••" \\
  -H "Idempotency-Key: 6f1d2c3e-qualif-req_123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "problem_type": "porte_fermee",
    "urgency": "absolue",
    "complexity": 2,
    "summary": "Porte fermée à double tour, clés perdues.",
    "suggested_price": { "min": 15400, "max": 21400 },
    "confidence": 0.91,
    "agent": "n8n · agent-qualification v1.3"
  }'`
  const verify = `// Nœud « Code » n8n : vérifier la signature d'un webhook UrgencePro
const crypto = require('crypto')
const [t, v1] = $json.headers['x-urgencepro-signature'].split(',').map(p => p.split('=')[1])
const expected = crypto.createHmac('sha256', $env.URGENCEPRO_WEBHOOK_SECRET)
  .update(t + '.' + JSON.stringify($json.body)).digest('hex')
if (expected !== v1 || Date.now() / 1000 - Number(t) > 300) throw new Error('Signature invalide')
return $json.body`
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="overflow-hidden xl:col-span-2">
        <CardHeader title="Principaux endpoints" subtitle="Spécification OpenAPI complète sur /v1/openapi.json · authentification par clé Bearer · 120 req/min · Idempotency-Key sur les POST" />
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <tbody>
              {ENDPOINTS.map(([m, p, s, d]) => (
                <tr key={m + p} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Badge tone={m === 'GET' ? 'info' : 'ok'} className="font-mono">
                      {m}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-[13px]">{p}</td>
                  <td className="px-3 py-2">
                    <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[11px]">{s}</code>
                  </td>
                  <td className="px-3 py-2 text-muted">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="min-w-0">
        <CardHeader title="Exemple : qualification par l’agent IA" />
        <pre className="mx-4 mb-4 overflow-x-auto rounded bg-ink p-3 font-mono text-[12px] text-ink-fg">{curl}</pre>
      </Card>
      <Card className="min-w-0">
        <CardHeader title="Exemple : vérifier la signature dans n8n" />
        <pre className="mx-4 mb-4 overflow-x-auto rounded bg-ink p-3 font-mono text-[12px] text-ink-fg">{verify}</pre>
      </Card>
    </div>
  )
}
