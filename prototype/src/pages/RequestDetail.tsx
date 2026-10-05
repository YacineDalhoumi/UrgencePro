import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Camera, MapPin, Send, ExternalLink, FileText, CalendarPlus, Receipt, Phone, MessageSquare, Clock, AlertTriangle, Bot, ChevronLeft, Navigation, Check, StickyNote, ShieldCheck,
} from 'lucide-react'
import { useStore } from '@/store/store'
import { useLookups, addressOf } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, Dialog, Empty, Field, Input, Select, Textarea, toneBg } from '@/components/ui/primitives'
import {
  AiBadge, AiDecision, CallBadge, InvoiceBadge, JobBadge, PriceBreakdown, QuoteBadge, RequestBadge, TechChip, UrgencyBadge, Stars,
} from '@/components/shared/bits'
import { CityMap } from '@/components/shared/CityMap'
import { MediaArt } from '@/components/shared/MediaArt'
import { CLIENT_TYPE, HOUSING_LABEL, LOST_REASONS, PIPELINE, PROBLEM_TYPES, REQUEST_STATUS, SOURCE_LABEL, TRANSITIONS, URGENCY, problemByCode } from '@/data/reference'
import { suggestTechnicians } from '@/data/scheduling'
import { totals } from '@/data/pricing'
import type { RequestStatus, ServiceRequest, Urgency } from '@/data/types'
import { ago, cn, dateTimeFr, durationFr, money, percent, phone, timeFr, MINUTE } from '@/lib/utils'

export function RequestDetailPage() {
  const { id } = useParams()
  const { ds, clients } = useLookups()
  const req = ds.requests.find((r) => r.id === id)
  if (!req) return <Empty title="Demande introuvable" text="Elle appartient peut-être à l’autre entreprise de démonstration." action={<Link to="/demandes" className="text-accent underline">Retour aux demandes</Link>} />
  const client = clients.get(req.clientId)!
  return (
    <div>
      <Header req={req} />
      <Stepper status={req.status} />
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          {req.ai?.reviewStatus === 'proposed' && <AiProposalCard req={req} />}
          <QualificationCard req={req} />
          <MediaCard req={req} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <QuoteCard req={req} />
            <InvoiceCard req={req} />
          </div>
          <JobCard req={req} />
        </div>
        <div className="min-w-0 space-y-4">
          <ClientCard req={req} clientId={client.id} />
          <ThreadCard req={req} />
          <TimelineCard req={req} />
        </div>
      </div>
    </div>
  )
}

function Header({ req }: { req: ServiceRequest }) {
  const changeStatus = useStore((s) => s.changeStatus)
  const [lost, setLost] = React.useState<null | 'perdue' | 'annulee'>(null)
  const [reason, setReason] = React.useState(LOST_REASONS[0])
  const next = TRANSITIONS[req.status].filter((s) => !['perdue', 'annulee', 'planifiee', 'devis_envoye', 'en_route', 'sur_place', 'terminee', 'facturee', 'payee'].includes(s))
  return (
    <div className="mb-4">
      <Link to="/demandes" className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-fg">
        <ChevronLeft className="size-4" /> Demandes
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{problemByCode[req.problemTypeCode]?.label}</h1>
            <UrgencyBadge u={req.urgency} />
            <RequestBadge s={req.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono">{req.ref}</span> · {SOURCE_LABEL[req.source]} · créée {dateTimeFr(req.createdAt)} ({ago(req.createdAt)})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next.map((s) => (
            <Button key={s} onClick={() => changeStatus(req.id, s)}>
              <Check /> Marquer {REQUEST_STATUS[s].label.toLowerCase()}
            </Button>
          ))}
          {TRANSITIONS[req.status].includes('perdue') && (
            <Button variant="ghost" onClick={() => setLost('perdue')}>
              Marquer perdue
            </Button>
          )}
          {TRANSITIONS[req.status].includes('annulee') && (
            <Button variant="ghost" onClick={() => setLost('annulee')}>
              Annuler
            </Button>
          )}
        </div>
      </div>
      <Dialog open={!!lost} onOpenChange={(v) => !v && setLost(null)} title={lost === 'perdue' ? 'Marquer la demande comme perdue' : 'Annuler la demande'} description="Le motif alimente les statistiques de conversion.">
        <Field label="Motif" htmlFor="lost-reason">
          <Select id="lost-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {LOST_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
            <option>Annulation du client</option>
          </Select>
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setLost(null)}>Retour</Button>
          <Button
            variant="danger"
            onClick={() => {
              changeStatus(req.id, lost!, reason)
              setLost(null)
            }}
          >
            Confirmer
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function Stepper({ status }: { status: RequestStatus }) {
  const terminal = status === 'perdue' || status === 'annulee'
  const idx = status === 'cloturee' ? PIPELINE.length : PIPELINE.indexOf(status)
  return (
    <div className="scroll-thin overflow-x-auto">
      <ol className="flex min-w-[760px] gap-1">
        {PIPELINE.map((s, i) => {
          const done = !terminal && i < idx
          const cur = !terminal && i === idx
          return (
            <li key={s} className="flex-1">
              <div className={cn('h-1.5 rounded-sm', done ? 'bg-ok' : cur ? toneBg[REQUEST_STATUS[s].tone] : 'bg-border')} />
              <div className={cn('mt-1.5 text-[11px] font-semibold', cur ? 'text-fg' : 'text-muted')}>{REQUEST_STATUS[s].label}</div>
            </li>
          )
        })}
      </ol>
      {terminal && <p className="mt-2 text-sm font-semibold text-bad">Demande {REQUEST_STATUS[status].label.toLowerCase()}</p>}
    </div>
  )
}

function AiProposalCard({ req }: { req: ServiceRequest }) {
  const validateAi = useStore((s) => s.validateAi)
  const { techs } = useLookups()
  const ai = req.ai!
  const rows: [string, string, string][] = [
    ['Problème', problemByCode[req.problemTypeCode]?.label, problemByCode[ai.problemTypeCode]?.label],
    ['Urgence', URGENCY[req.urgency].label, URGENCY[ai.urgency].label],
    ['Complexité', `${req.complexity} / 5`, `${ai.complexity} / 5`],
    ['Durée estimée', durationFr(req.durationMin), durationFr(ai.durationMin)],
    ['Prix suggéré TTC', '—', `${money(ai.priceMinCents)} – ${money(ai.priceMaxCents)}`],
  ]
  const tech = ai.suggestedTechnicianId ? techs.get(ai.suggestedTechnicianId) : undefined
  return (
    <Card className="border-ai/40 bg-ai-soft/40">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div>
          <AiBadge />
          <h3 className="mt-2 font-display text-[15px] font-bold">Qualification proposée par l’agent IA</h3>
          <p className="text-[12px] text-muted">
            {ai.agent} · reçue {ago(ai.processedAt)} via <span className="font-mono">POST /v1/requests/{'{id}'}/ai-qualification</span>
          </p>
        </div>
        <div className="text-right">
          <div className="label-caps text-muted">Confiance</div>
          <div className="font-display text-2xl font-extrabold text-ai tnum">{percent(ai.confidence)}</div>
          <div className="mt-1 h-1.5 w-28 rounded-sm bg-surface">
            <div className="h-full rounded-sm bg-ai" style={{ width: `${ai.confidence * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="rounded border border-ai/20 bg-surface p-3 text-sm leading-relaxed">{ai.summary}</p>
        <div className="scroll-thin mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="py-1 font-semibold">Champ</th>
                <th className="py-1 font-semibold">Actuel</th>
                <th className="py-1 font-semibold text-ai">Proposé</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, a, b]) => (
                <tr key={k} className="border-t border-ai/15">
                  <td className="py-1.5 text-muted">{k}</td>
                  <td className="py-1.5">{a}</td>
                  <td className={cn('py-1.5 font-semibold', a !== b && 'text-ai')}>{b}</td>
                </tr>
              ))}
              {tech && (
                <tr className="border-t border-ai/15">
                  <td className="py-1.5 text-muted">Technicien suggéré</td>
                  <td className="py-1.5">—</td>
                  <td className="py-1.5">
                    <TechChip tech={tech} size={22} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <AiDecision onAccept={() => validateAi(req.id, 'accepted')} onReject={() => validateAi(req.id, 'rejected')} />
          <span className="text-[12px] text-muted">Application automatique désactivée (Paramètres → Automatisations).</span>
        </div>
      </div>
    </Card>
  )
}

function QualificationCard({ req }: { req: ServiceRequest }) {
  const { ds } = useLookups()
  const update = useStore((s) => s.updateQualification)
  const problems = PROBLEM_TYPES.filter((p) => ds.company.trades.includes(p.trade))
  const editable = ['nouvelle', 'qualifiee'].includes(req.status)
  return (
    <Card>
      <CardHeader
        title="Qualification et prix"
        subtitle="Prix calculé depuis votre grille tarifaire. Le client voit ce détail avant toute intervention."
        action={req.ai && req.ai.reviewStatus !== 'proposed' ? <AiBadge label={req.ai.reviewStatus === 'rejected' ? 'IA rejetée' : req.ai.reviewStatus === 'edited' ? 'IA corrigée' : 'IA validée'} /> : undefined}
      />
      <div className="grid grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Type de problème" htmlFor="q-problem">
            <Select id="q-problem" value={req.problemTypeCode} disabled={!editable} onChange={(e) => update(req.id, { problemTypeCode: e.target.value })}>
              {problems.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Urgence" htmlFor="q-urgency">
            <Select id="q-urgency" value={req.urgency} disabled={!editable} onChange={(e) => update(req.id, { urgency: e.target.value as Urgency })}>
              {Object.entries(URGENCY).map(([k, u]) => (
                <option key={k} value={k}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Complexité" hint={`Durée estimée : ${durationFr(req.durationMin)}`}>
            <div className="flex gap-1" role="radiogroup" aria-label="Complexité">
              {[1, 2, 3, 4, 5].map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={req.complexity === c}
                  disabled={!editable}
                  onClick={() => update(req.id, { complexity: c })}
                  className={cn('h-10 flex-1 rounded border text-sm font-bold tnum disabled:opacity-60', req.complexity === c ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface hover:bg-sunken')}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Description du client" htmlFor="q-desc">
            <Textarea id="q-desc" defaultValue={req.description} disabled={!editable} onBlur={(e) => e.target.value !== req.description && update(req.id, { description: e.target.value })} />
          </Field>
          {req.estimate.outOfZone && (
            <div className="flex gap-2 rounded border border-bad/30 bg-bad-soft p-3 text-sm text-bad">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Adresse hors zone d’intervention. Proposez le partenaire « Serrurerie du Val » ou envoyez le message de refus poli.</span>
            </div>
          )}
        </div>
        <div className="rounded border border-border bg-sunken/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="label-caps text-muted">Détail affiché au client</span>
            <Badge tone="ok">
              <ShieldCheck className="size-3.5" /> Prix transparent
            </Badge>
          </div>
          <PriceBreakdown est={req.estimate} />
          <p className="mt-2 text-[12px] text-muted">
            TVA {addressOfReq(ds, req)?.housingType === 'local_pro' ? '20 %' : '10 % (logement de plus de 2 ans, attestation du client)'} · {req.estimate.zone}
          </p>
        </div>
      </div>
    </Card>
  )
}

const addressOfReq = (ds: ReturnType<typeof useLookups>['ds'], req: ServiceRequest) => addressOf(ds, req.clientId, req.addressId)

function MediaCard({ req }: { req: ServiceRequest }) {
  const { ds } = useLookups()
  const sendPhotoLink = useStore((s) => s.sendPhotoLink)
  const navigate = useNavigate()
  const [zoom, setZoom] = React.useState<string | null>(null)
  const addr = addressOfReq(ds, req)!
  const waiting = req.photoLinkSentAt && !req.media.length
  const zoomed = req.media.find((m) => m.id === zoom)
  return (
    <Card>
      <CardHeader
        title="Photos et localisation"
        subtitle={req.photoLinkSentAt ? `Lien sécurisé envoyé ${ago(req.photoLinkSentAt)} · expire dans 48 h` : 'Demandez des photos pour annoncer un prix plus précis.'}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant={req.photoLinkSentAt ? 'secondary' : 'primary'} onClick={() => sendPhotoLink(req.id)}>
              <Send /> {req.photoLinkSentAt ? 'Renvoyer le lien' : 'Envoyer le lien (SMS)'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(`/client/${req.id}/photos`)} title="Jouer le rôle du client">
              <ExternalLink /> Vue client
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {req.media.length ? (
            <div className="grid grid-cols-3 gap-2">
              {req.media.map((m) => (
                <button key={m.id} onClick={() => setZoom(m.id)} className="group relative aspect-[10/9] overflow-hidden rounded border border-border">
                  <MediaArt media={m} />
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-left text-[11px] font-semibold text-white">
                    {m.caption}
                    <span className="block font-normal opacity-80">{m.category === 'client' ? 'Client' : m.category === 'avant' ? 'Avant' : 'Après'} · {timeFr(m.at)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 rounded border border-dashed border-border p-4 text-center text-sm text-muted">
              <Camera className="size-6" />
              {waiting ? (
                <>
                  <span>En attente des photos du client…</span>
                  <span className="text-[12px]">Relance automatique prévue à {timeFr(req.photoLinkSentAt! + 15 * MINUTE)}</span>
                </>
              ) : (
                <span>Aucune photo pour l’instant.</span>
              )}
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <div className="aspect-[1000/680] w-full overflow-hidden rounded border border-border">
            <CityMap city={ds.company.city} center={addr.location} zoom={2.2} markers={[{ id: 'a', at: addr.location, kind: 'job', label: addr.line1.split(' ').slice(0, 4).join(' ') }]} />
          </div>
          <div className="mt-2 space-y-0.5 text-sm">
            <div className="flex items-center gap-1.5 font-semibold">
              <MapPin className="size-4 text-accent" />
              {addr.line1}, {addr.postalCode} {addr.city}
            </div>
            <div className="text-[13px] text-muted">
              {HOUSING_LABEL[addr.housingType]}
              {addr.floor && ` · ${addr.floor}`}
              {addr.doorCode && ` · code ${addr.doorCode}`}
              {addr.intercom && ` · interphone ${addr.intercom}`}
            </div>
            {addr.accessNotes && <div className="text-[13px]">« {addr.accessNotes} »</div>}
            {req.locationShared && (
              <Badge tone="ok" className="mt-1">
                <Navigation className="size-3.5" /> {req.locationShared.method === 'gps' ? 'Position GPS partagée' : 'Adresse confirmée'} {ago(req.locationShared.at)}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <Dialog open={!!zoomed} onOpenChange={(v) => !v && setZoom(null)} title={zoomed?.caption ?? ''} description={zoomed ? `Envoyée ${dateTimeFr(zoomed.at)}` : undefined} wide>
        {zoomed && (
          <div className="aspect-[10/9] w-full overflow-hidden rounded">
            <MediaArt media={zoomed} />
          </div>
        )}
      </Dialog>
    </Card>
  )
}

function QuoteCard({ req }: { req: ServiceRequest }) {
  const { quotes } = useLookups()
  const createQuote = useStore((s) => s.createQuote)
  const navigate = useNavigate()
  const q = req.quoteId ? quotes.get(req.quoteId) : undefined
  return (
    <Card>
      <CardHeader title="Devis" action={q ? <QuoteBadge s={q.status} /> : undefined} />
      <div className="px-4 pb-4 text-sm">
        {q ? (
          <>
            <div className="flex items-baseline justify-between">
              <Link to={`/devis/${q.id}`} className="font-mono font-medium text-accent hover:underline">
                {q.ref}
              </Link>
              <span className="font-display text-lg font-bold tnum">{money(totals(q.lines).ttc)}</span>
            </div>
            <ul className="mt-2 space-y-1 text-[13px] text-muted">
              {q.sentAt && <li>Envoyé {dateTimeFr(q.sentAt)}</li>}
              {q.viewedAt && <li>Consulté {dateTimeFr(q.viewedAt)}</li>}
              {q.signedAt && (
                <li className="font-semibold text-ok">
                  Signé {dateTimeFr(q.signedAt)} par {q.signerName}
                </li>
              )}
              {q.reminders.map((r, i) => (
                <li key={i}>Relance J+{[1, 3, 7][i]} envoyée {dateTimeFr(r)}</li>
              ))}
            </ul>
            <Button size="sm" className="mt-3" onClick={() => navigate(`/devis/${q.id}`)}>
              <FileText /> Ouvrir le devis
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted">Devis obligatoire au-delà de 150 € TTC. Pré-rempli depuis la qualification et la grille tarifaire.</p>
            <Button
              size="sm"
              variant="primary"
              className="mt-3"
              disabled={['cloturee', 'perdue', 'annulee'].includes(req.status)}
              onClick={() => {
                const id = createQuote(req.id)
                navigate(`/devis/${id}`)
              }}
            >
              <FileText /> Générer le devis
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}

function InvoiceCard({ req }: { req: ServiceRequest }) {
  const { invoices } = useLookups()
  const createInvoice = useStore((s) => s.createInvoice)
  const recordPayment = useStore((s) => s.recordPayment)
  const inv = req.invoiceId ? invoices.get(req.invoiceId) : undefined
  const done = req.history.some((h) => h.status === 'terminee')
  return (
    <Card>
      <CardHeader title="Facture et paiement" action={inv ? <InvoiceBadge s={inv.status} /> : undefined} />
      <div className="px-4 pb-4 text-sm">
        {inv ? (
          <>
            <div className="flex items-baseline justify-between">
              <Link to={`/factures?f=${inv.id}`} className="font-mono font-medium text-accent hover:underline">
                {inv.ref}
              </Link>
              <span className="font-display text-lg font-bold tnum">{money(totals(inv.lines).ttc)}</span>
            </div>
            <p className="mt-1 text-[13px] text-muted">Émise {dateTimeFr(inv.issuedAt)}</p>
            {inv.payments.map((p) => (
              <p key={p.id} className="text-[13px] font-semibold text-ok">
                Payée {dateTimeFr(p.at)} · {money(p.amountCents)}
              </p>
            ))}
            {inv.status !== 'payee' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="ok" onClick={() => recordPayment(inv.id, 'cb_en_ligne')}>
                  Simuler paiement en ligne
                </Button>
                <Button size="sm" onClick={() => recordPayment(inv.id, 'cheque')}>
                  Chèque reçu
                </Button>
              </div>
            )}
          </>
        ) : done ? (
          <>
            <p className="text-muted">Intervention terminée. La facture reprend le devis signé ou le rapport du technicien.</p>
            <Button size="sm" variant="primary" className="mt-3" onClick={() => createInvoice(req.id)}>
              <Receipt /> Créer la facture
            </Button>
          </>
        ) : (
          <p className="text-muted">Disponible après l’intervention. Numérotation continue et document verrouillé à l’émission.</p>
        )}
      </div>
    </Card>
  )
}

function JobCard({ req }: { req: ServiceRequest }) {
  const { ds, jobs, techs } = useLookups()
  const assignJob = useStore((s) => s.assignJob)
  const job = req.jobId ? jobs.get(req.jobId) : undefined
  const suggestions = React.useMemo(() => suggestTechnicians(ds, req), [ds, req])
  const [slot, setSlot] = React.useState('asap')
  const canPlan = ['nouvelle', 'qualifiee', 'acceptee', 'planifiee'].includes(req.status) && (!job || ['a_planifier', 'proposee', 'acceptee'].includes(job.status))
  const startFor = (etaMin: number) => {
    if (slot === 'asap') return Date.now() + Math.max(etaMin, 15) * MINUTE
    const [h, m] = slot.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  const tech = job?.technicianId ? techs.get(job.technicianId) : undefined

  return (
    <Card>
      <CardHeader
        title="Intervention"
        subtitle={job?.technicianId ? undefined : 'Technicien le plus adapté : compétences, disponibilité, temps de trajet et charge du jour.'}
        action={job ? <JobBadge s={job.status} /> : undefined}
      />
      <div className="px-4 pb-4">
        {job?.technicianId && (
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-border bg-sunken/50 p-3 text-sm">
            <TechChip tech={tech} size={32} />
            <span>
              <span className="text-muted">Créneau </span>
              <b className="tnum">{dateTimeFr(job.start)}</b>
            </span>
            {job.status === 'en_route' && (
              <span className="font-semibold text-accent tnum">Arrivée estimée dans {job.etaMin} min</span>
            )}
            {job.arrivedAt && <span className="text-muted">Arrivé à {timeFr(job.arrivedAt)}</span>}
            {job.completedAt && <span className="text-muted">Terminé à {timeFr(job.completedAt)}</span>}
            <Link to="/tech" className="text-[13px] font-semibold text-accent hover:underline">
              Voir dans l’appli technicien
            </Link>
          </div>
        )}
        {job?.report && (
          <div className="mb-4 rounded border border-border p-3 text-sm">
            <div className="label-caps mb-1 text-muted">Rapport d’intervention</div>
            <p>{job.report.workDone}</p>
            {job.report.observations && <p className="text-muted">{job.report.observations}</p>}
            {job.report.parts.length > 0 && <p className="mt-1 text-[13px]">Pièces : {job.report.parts.map((p) => `${p.quantity} × ${p.label}`).join(', ')}</p>}
            {job.report.signerName && <p className="mt-1 text-[13px] text-ok">Signé par {job.report.signerName}</p>}
          </div>
        )}
        {canPlan && (
          <>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <Field label="Créneau" htmlFor="slot" className="w-48">
                <Select id="slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
                  <option value="asap">Dès que possible</option>
                  {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((t) => (
                    <option key={t} value={t}>
                      {t.replace(':', ' h ')}
                    </option>
                  ))}
                </Select>
              </Field>
              {req.ai?.suggestedTechnicianId && (
                <span className="pb-2">
                  <AiBadge label="Suggestion IA disponible" />
                </span>
              )}
            </div>
            <div className="space-y-2">
              {suggestions.slice(0, 4).map((s, i) => (
                <div key={s.tech.id} className={cn('flex flex-wrap items-center gap-3 rounded border p-3', i === 0 ? 'border-accent/50 bg-accent-soft/40' : 'border-border')}>
                  <TechChip tech={s.tech} size={32} />
                  {i === 0 && <Badge tone="accent">Recommandé</Badge>}
                  {req.ai?.suggestedTechnicianId === s.tech.id && <AiBadge label="IA" />}
                  <div className="min-w-0 flex-1 text-[13px] text-muted">{s.reasons.join(' · ')}</div>
                  <div className="flex items-center gap-2">
                    {s.rating && (
                      <span className="hidden items-center gap-1 text-[12px] tnum sm:inline-flex">
                        <Stars value={s.rating} size={12} /> {s.rating.toFixed(1)}
                      </span>
                    )}
                    <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'} disabled={!s.skilled} onClick={() => assignJob(req.id, s.tech.id, startFor(s.etaMin))}>
                      <CalendarPlus /> {job?.technicianId === s.tech.id ? 'Reproposer' : 'Proposer'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted">Le technicien reçoit une notification avec « Accepter / Refuser ». Le client reçoit le SMS de confirmation avec l’heure d’arrivée.</p>
          </>
        )}
        {!job && !canPlan && <p className="text-sm text-muted">Pas d’intervention pour cette demande.</p>}
      </div>
    </Card>
  )
}

function ClientCard({ req, clientId }: { req: ServiceRequest; clientId: string }) {
  const { ds, clients } = useLookups()
  const c = clients.get(clientId)!
  const history = ds.requests.filter((r) => r.clientId === c.id && r.id !== req.id)
  return (
    <Card>
      <CardHeader title={c.companyName ?? `${c.firstName} ${c.lastName}`} subtitle={CLIENT_TYPE[c.type]} action={<Link to={`/clients/${c.id}`} className="text-[13px] font-semibold text-accent hover:underline">Fiche</Link>} />
      <div className="space-y-2 px-4 pb-4 text-sm">
        <div className="flex items-center gap-2 tnum">
          <Phone className="size-4 text-muted" /> {phone(c.phone)}
        </div>
        {c.email && <div className="truncate text-muted">{c.email}</div>}
        {c.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        )}
        {c.smsOptOut && <Badge tone="bad">Opposition SMS (STOP)</Badge>}
        <div className="rounded bg-sunken p-2.5 text-[13px]">
          {history.length ? (
            <>
              <b>Client connu</b> · {history.length} demande{history.length > 1 ? 's' : ''} précédente{history.length > 1 ? 's' : ''}
              <ul className="mt-1 space-y-0.5 text-muted">
                {history.slice(0, 3).map((h) => (
                  <li key={h.id}>
                    <Link to={`/demandes/${h.id}`} className="hover:underline">
                      {problemByCode[h.problemTypeCode]?.label} · {dateTimeFr(h.createdAt)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            'Premier contact avec ce client.'
          )}
        </div>
      </div>
    </Card>
  )
}

function ThreadCard({ req }: { req: ServiceRequest }) {
  const { ds } = useLookups()
  const sendSms = useStore((s) => s.sendSms)
  const [text, setText] = React.useState('')
  const items = React.useMemo(() => {
    const sms = ds.sms.filter((s) => s.requestId === req.id || (s.clientId === req.clientId && !s.requestId))
    const calls = ds.calls.filter((c) => c.requestId === req.id)
    return [...sms.map((s) => ({ kind: 'sms' as const, at: s.at, s })), ...calls.map((c) => ({ kind: 'call' as const, at: c.at, c }))].sort((a, b) => a.at - b.at)
  }, [ds.sms, ds.calls, req.id, req.clientId])
  const end = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [items.length])
  return (
    <Card>
      <CardHeader title="Échanges" subtitle="SMS et appels de cette demande" />
      <div className="scroll-thin max-h-[420px] space-y-2 overflow-y-auto px-4 pb-2">
        {items.length === 0 && <p className="py-4 text-center text-sm text-muted">Aucun échange.</p>}
        {items.map((it) =>
          it.kind === 'call' ? (
            <div key={it.c.id} className="rounded border border-border p-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Phone className="size-3.5" /> Appel {dateTimeFr(it.c.at)}
                </span>
                <CallBadge s={it.c.status} />
              </div>
              {it.c.aiSummary && (
                <p className="mt-1.5 flex gap-1.5 text-muted">
                  <Bot className="mt-0.5 size-3.5 shrink-0 text-ai" /> {it.c.aiSummary}
                </p>
              )}
              {it.c.recording && <p className="mt-1 text-[12px] text-muted">Enregistrement {durationFr(it.c.durationSec / 60)} · consentement annoncé</p>}
            </div>
          ) : (
            <div key={it.s.id} className={cn('flex', it.s.direction === 'sortant' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[88%] rounded-lg px-3 py-2 text-[13px] leading-snug', it.s.direction === 'sortant' ? 'rounded-br-sm bg-ink text-ink-fg' : 'rounded-bl-sm border border-border bg-sunken')}>
                {it.s.body}
                <div className={cn('mt-1 text-[11px]', it.s.direction === 'sortant' ? 'text-ink-fg/60' : 'text-muted')}>
                  {timeFr(it.s.at)} · {it.s.direction === 'entrant' ? 'Client' : it.s.by === 'automatisation' ? 'Automatique' : it.s.by === 'agent_ia' ? 'Agent IA' : 'Vous'}
                  {it.s.direction === 'sortant' && ' · distribué'}
                </div>
              </div>
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          sendSms(req.clientId, text.trim(), req.id)
          setText('')
        }}
      >
        <Input id="sms-compose" value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un SMS au client…" />
        <Button type="submit" variant="primary" size="icon" aria-label="Envoyer le SMS">
          <MessageSquare />
        </Button>
      </form>
    </Card>
  )
}

function TimelineCard({ req }: { req: ServiceRequest }) {
  const { ds } = useLookups()
  const addNote = useStore((s) => s.addNote)
  const [note, setNote] = React.useState('')
  const entries = [
    ...req.history.map((h) => ({ at: h.at, title: REQUEST_STATUS[h.status].label, sub: h.actor + (h.reason ? ` · ${h.reason}` : ''), tone: REQUEST_STATUS[h.status].tone, icon: Clock })),
    ...req.notes.map((n) => ({ at: n.at, title: n.text, sub: n.author, tone: 'neutral' as const, icon: StickyNote })),
  ].sort((a, b) => b.at - a.at)
  const events = ds.events.filter((e) => e.entityId === req.id || e.entityId === req.jobId || e.entityId === req.quoteId || e.entityId === req.invoiceId || e.entityId === req.callId).length
  return (
    <Card>
      <CardHeader title="Historique" subtitle={`${events} événement${events > 1 ? 's' : ''} transmis aux webhooks`} />
      <ol className="space-y-3 px-4 pb-3">
        {entries.map((e, i) => (
          <li key={i} className="flex gap-3">
            <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', toneBg[e.tone])} />
            <div className="min-w-0 text-sm">
              <div className="font-semibold leading-snug">{e.title}</div>
              <div className="text-[12px] text-muted">
                {dateTimeFr(e.at)} · {e.sub}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!note.trim()) return
          addNote(req.id, note.trim())
          setNote('')
        }}
      >
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note interne…" />
        <Button type="submit">Ajouter</Button>
      </form>
    </Card>
  )
}
