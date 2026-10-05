import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { List, SquareKanban, Plus, Sparkles, Camera, MapPin } from 'lucide-react'
import { z } from 'zod'
import { toast } from 'sonner'
import { useStore } from '@/store/store'
import { useLookups } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Card, Dialog, Field, Input, Select, Textarea, Badge } from '@/components/ui/primitives'
import { PageHeader, PriceRange, RequestBadge, TechChip, UrgencyBadge } from '@/components/shared/bits'
import { PIPELINE, PROBLEM_TYPES, REQUEST_STATUS, SOURCE_LABEL, TRANSITIONS, URGENCY, CLIENT_TYPE } from '@/data/reference'
import type { RequestStatus, ServiceRequest, Urgency, ClientType } from '@/data/types'
import { ago, cn, dateTimeFr } from '@/lib/utils'

type View = 'liste' | 'kanban'

const FILTERS: { key: string; label: string; match: (r: ServiceRequest) => boolean }[] = [
  { key: 'en_cours', label: 'En cours', match: (r) => !['cloturee', 'annulee', 'perdue', 'payee'].includes(r.status) },
  { key: 'nouvelle', label: 'Nouvelles', match: (r) => r.status === 'nouvelle' },
  { key: 'devis', label: 'Devis envoyés', match: (r) => r.status === 'devis_envoye' },
  { key: 'terrain', label: 'Sur le terrain', match: (r) => ['planifiee', 'en_route', 'sur_place'].includes(r.status) },
  { key: 'a_facturer', label: 'À facturer / encaisser', match: (r) => ['terminee', 'facturee'].includes(r.status) },
  { key: 'perdues', label: 'Perdues / annulées', match: (r) => ['perdue', 'annulee'].includes(r.status) },
  { key: 'toutes', label: 'Toutes', match: () => true },
]

function readView(): View {
  try {
    return localStorage.getItem('up-requests-view') === 'kanban' ? 'kanban' : 'liste'
  } catch {
    return 'liste'
  }
}

export function RequestsPage() {
  const { ds, clients, techs, jobs } = useLookups()
  const [view, setViewState] = React.useState<View>(readView)
  const [filter, setFilter] = React.useState('en_cours')
  const [urgency, setUrgency] = React.useState<'' | Urgency>('')
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(0)
  const [creating, setCreating] = React.useState(false)
  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem('up-requests-view', v)
    } catch {
      /* préférence non mémorisée */
    }
  }

  const rows = React.useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!
    const t = q.trim().toLowerCase()
    return ds.requests.filter((r) => {
      if (!f.match(r)) return false
      if (urgency && r.urgency !== urgency) return false
      if (t) {
        const c = clients.get(r.clientId)
        const hay = `${r.ref} ${c?.firstName} ${c?.lastName} ${c?.companyName ?? ''} ${c?.phone.replace('+33', '0')}`.toLowerCase()
        if (!hay.includes(t)) return false
      }
      return true
    })
  }, [ds.requests, filter, urgency, q, clients])

  React.useEffect(() => setPage(0), [filter, urgency, q])
  const PAGE = 25
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE)

  return (
    <div>
      <PageHeader
        title="Demandes"
        subtitle="Chaque appel, SMS ou formulaire crée une demande. Suivez-la jusqu’au paiement."
        actions={
          <>
            <div className="flex rounded border border-border bg-surface p-0.5">
              {(
                [
                  ['liste', 'Liste', List],
                  ['kanban', 'Kanban', SquareKanban],
                ] as const
              ).map(([k, l, I]) => (
                <button key={k} onClick={() => setView(k)} className={cn('flex h-8 items-center gap-1.5 rounded px-3 text-[13px] font-semibold', view === k ? 'bg-ink text-ink-fg' : 'text-muted hover:text-fg')}>
                  <I className="size-4" /> {l}
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus /> Nouvelle demande
            </Button>
          </>
        }
      />

      {view === 'liste' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="scroll-thin flex max-w-full gap-1 overflow-x-auto">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn('h-8 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold', filter === f.key ? 'border-ink bg-ink text-ink-fg' : 'border-border bg-surface text-muted hover:text-fg')}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
              <Select id="filter-urgency" aria-label="Urgence" value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency | '')} className="h-9 sm:w-40">
                <option value="">Toutes urgences</option>
                {Object.entries(URGENCY).map(([k, u]) => (
                  <option key={k} value={k}>
                    {u.short}
                  </option>
                ))}
              </Select>
              <Input id="filter-q" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 sm:w-56" />
            </div>
          </div>
          <Card className="overflow-hidden">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-sunken text-left text-[12px] text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Demande</th>
                    <th className="px-3 py-2.5 font-semibold">Client</th>
                    <th className="px-3 py-2.5 font-semibold">Problème</th>
                    <th className="px-3 py-2.5 font-semibold">Urgence</th>
                    <th className="px-3 py-2.5 font-semibold">Statut</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Prix annoncé TTC</th>
                    <th className="px-3 py-2.5 font-semibold">Technicien</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const c = clients.get(r.clientId)
                    const job = r.jobId ? jobs.get(r.jobId) : undefined
                    return (
                      <tr key={r.id} className="border-t border-border hover:bg-sunken/60">
                        <td className="px-4 py-2.5">
                          <Link to={`/demandes/${r.id}`} className="font-mono text-[13px] font-medium text-accent hover:underline">
                            {r.ref}
                          </Link>
                          <div className="text-[12px] text-muted">
                            {dateTimeFr(r.createdAt)} · {SOURCE_LABEL[r.source]}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold">{c?.companyName ?? `${c?.firstName} ${c?.lastName}`}</div>
                          <div className="text-[12px] text-muted">{c?.addresses.find((a) => a.id === r.addressId)?.city}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            {PROBLEM_TYPES.find((p) => p.code === r.problemTypeCode)?.label}
                            {r.ai?.reviewStatus === 'proposed' && <Sparkles className="size-3.5 text-ai" aria-label="Proposition IA à valider" />}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <UrgencyBadge u={r.urgency} />
                        </td>
                        <td className="px-3 py-2.5">
                          <RequestBadge s={r.status} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <PriceRange est={r.estimate} />
                        </td>
                        <td className="px-3 py-2.5">{job?.technicianId ? <TechChip tech={techs.get(job.technicianId)} size={22} /> : <span className="text-muted">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[13px] text-muted">
              <span className="tnum">
                {rows.length ? `${page * PAGE + 1}–${Math.min(rows.length, (page + 1) * PAGE)} sur ${rows.length}` : 'Aucune demande'}
              </span>
              <div className="flex gap-2">
                <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </Button>
                <Button size="sm" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage((p) => p + 1)}>
                  Suivant
                </Button>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Kanban />
      )}
      <NewRequestDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

// ——— Kanban ———

const KANBAN: RequestStatus[] = PIPELINE.filter((s) => s !== 'payee')

function Kanban() {
  const { ds, clients, techs, jobs } = useLookups()
  const changeStatus = useStore((s) => s.changeStatus)
  const navigate = useNavigate()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const recent = Date.now() - 3 * 24 * 3600_000
  const cols = React.useMemo(() => {
    const m = new Map<RequestStatus, ServiceRequest[]>(KANBAN.map((s) => [s, []]))
    for (const r of ds.requests) {
      if (!m.has(r.status)) continue
      if (r.status === 'facturee' && r.createdAt < recent) continue
      m.get(r.status)!.push(r)
    }
    return m
  }, [ds.requests, recent])

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id)
    const to = e.over?.id as RequestStatus | undefined
    const r = ds.requests.find((x) => x.id === id)
    if (!r || !to || r.status === to) return
    if (!TRANSITIONS[r.status].includes(to)) {
      toast.error(`Passage impossible : ${REQUEST_STATUS[r.status].label} → ${REQUEST_STATUS[to].label}`, { description: 'Le cycle de vie suit des étapes obligatoires.' })
      return
    }
    if (to === 'planifiee' || to === 'devis_envoye') {
      toast(to === 'planifiee' ? 'Choisissez le technicien et le créneau' : 'Préparez et envoyez le devis', { description: 'Ouverture de la fiche demande.' })
      navigate(`/demandes/${id}`)
      return
    }
    changeStatus(id, to, to === 'perdue' ? 'Client injoignable' : undefined)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <p className="mb-3 text-sm text-muted">Glissez une carte d’une colonne à l’autre. Les étapes interdites par le cycle de vie sont refusées.</p>
      <div className="scroll-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        {KANBAN.map((s) => (
          <KanbanColumn key={s} status={s} count={cols.get(s)!.length}>
            {cols.get(s)!.slice(0, 30).map((r) => {
              const c = clients.get(r.clientId)
              const job = r.jobId ? jobs.get(r.jobId) : undefined
              return (
                <KanbanCard key={r.id} id={r.id}>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/demandes/${r.id}`} className="font-mono text-[12px] font-medium text-accent hover:underline" onPointerDown={(e) => e.stopPropagation()}>
                      {r.ref}
                    </Link>
                    <UrgencyBadge u={r.urgency} />
                  </div>
                  <div className="mt-1.5 font-semibold leading-snug">{PROBLEM_TYPES.find((p) => p.code === r.problemTypeCode)?.label}</div>
                  <div className="text-[13px] text-muted">
                    {c?.companyName ?? `${c?.firstName} ${c?.lastName}`} · {c?.addresses.find((a) => a.id === r.addressId)?.city}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">
                      <PriceRange est={r.estimate} />
                    </span>
                    <span className="flex items-center gap-1.5 text-muted">
                      {r.ai?.reviewStatus === 'proposed' && <Sparkles className="size-3.5 text-ai" />}
                      {r.media.length > 0 && <Camera className="size-3.5" />}
                      {r.locationShared && <MapPin className="size-3.5" />}
                      {job?.technicianId && <TechChip tech={techs.get(job.technicianId)} size={20} showName={false} />}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{ago(r.history[r.history.length - 1].at)}</div>
                </KanbanCard>
              )
            })}
          </KanbanColumn>
        ))}
      </div>
    </DndContext>
  )
}

function KanbanColumn({ status, count, children }: { status: RequestStatus; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={cn('flex w-[272px] shrink-0 flex-col rounded-md border border-border bg-sunken/70', isOver && 'border-accent bg-accent-soft/40')}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <RequestBadge s={status} />
        <span className="text-[13px] font-bold text-muted tnum">{count}</span>
      </div>
      <div className="scroll-thin flex max-h-[calc(100dvh-280px)] min-h-[120px] flex-col gap-2 overflow-y-auto px-2 pb-2">{children}</div>
    </div>
  )
}

function KanbanCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn('cursor-grab rounded border border-border bg-surface p-3 text-sm shadow-sm active:cursor-grabbing', isDragging && 'z-10 rotate-1 shadow-xl')}
    >
      {children}
    </div>
  )
}

// ——— Création manuelle ———

const schema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis'),
  lastName: z.string().trim().min(1, 'Nom requis'),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/, 'Numéro français attendu, ex. 06 39 98 12 34'),
  line1: z.string().trim().min(4, 'Adresse requise'),
  postalCode: z.string().trim().regex(/^\d{5}$/, 'Code postal à 5 chiffres'),
  city: z.string().trim().min(2, 'Ville requise'),
  problemTypeCode: z.string().min(1),
  urgency: z.enum(['absolue', 'moins_2h', 'dans_la_journee', 'planifiee']),
  description: z.string().max(1000),
  type: z.enum(['particulier', 'professionnel', 'syndic', 'agence_immobiliere', 'assureur']),
})

function NewRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { ds } = useLookups()
  const createRequest = useStore((s) => s.createRequest)
  const navigate = useNavigate()
  const problems = PROBLEM_TYPES.filter((p) => ds.company.trades.includes(p.trade))
  const [form, setForm] = React.useState({ firstName: '', lastName: '', phone: '', line1: '', postalCode: ds.company.postalCodes[0], city: ds.company.city, problemTypeCode: problems[0].code, urgency: 'absolue' as Urgency, description: '', type: 'particulier' as ClientType })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const existing = React.useMemo(() => {
    const d = form.phone.replace(/\D/g, '').replace(/^33/, '0')
    return d.length >= 10 ? ds.clients.find((c) => c.phone.replace('+33', '0') === d) : undefined
  }, [form.phone, ds.clients])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = existing ? { ...form, firstName: existing.firstName, lastName: existing.lastName } : form
    const res = schema.safeParse(data)
    if (!res.success) {
      setErrors(Object.fromEntries(res.error.issues.map((i) => [i.path[0], i.message])))
      return
    }
    setErrors({})
    const phone = '+33' + form.phone.replace(/\D/g, '').replace(/^33/, '').replace(/^0/, '')
    const id = createRequest({ ...res.data, phone, clientId: existing?.id })
    onOpenChange(false)
    navigate(`/demandes/${id}`)
  }
  const err = (k: string) => errors[k] && <span className="text-[12px] font-semibold text-bad">{errors[k]}</span>

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Nouvelle demande" description="Saisie rapide pendant un appel. Le prix est calculé automatiquement." wide>
      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Téléphone" htmlFor="nr-phone" className="sm:col-span-2" hint={existing ? <Badge tone="ok">Client connu : {existing.firstName} {existing.lastName}</Badge> : 'Format : 06 39 98 12 34'}>
          <Input id="nr-phone" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="06 39 98 12 34" />
          {err('phone')}
        </Field>
        <Field label="Prénom" htmlFor="nr-first">
          <Input id="nr-first" value={existing?.firstName ?? form.firstName} onChange={set('firstName')} disabled={!!existing} />
          {!existing && err('firstName')}
        </Field>
        <Field label="Nom" htmlFor="nr-last">
          <Input id="nr-last" value={existing?.lastName ?? form.lastName} onChange={set('lastName')} disabled={!!existing} />
          {!existing && err('lastName')}
        </Field>
        <Field label="Type de client" htmlFor="nr-type">
          <Select id="nr-type" value={form.type} onChange={set('type')}>
            {Object.entries(CLIENT_TYPE).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Adresse" htmlFor="nr-line1">
          <Input id="nr-line1" value={form.line1} onChange={set('line1')} placeholder="12 rue Victor Hugo" />
          {err('line1')}
        </Field>
        <Field label="Code postal" htmlFor="nr-cp">
          <Input id="nr-cp" inputMode="numeric" value={form.postalCode} onChange={set('postalCode')} />
          {err('postalCode')}
        </Field>
        <Field label="Ville" htmlFor="nr-city">
          <Input id="nr-city" value={form.city} onChange={set('city')} />
          {err('city')}
        </Field>
        <Field label="Problème" htmlFor="nr-problem">
          <Select id="nr-problem" value={form.problemTypeCode} onChange={set('problemTypeCode')}>
            {problems.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Urgence" htmlFor="nr-urgency">
          <Select id="nr-urgency" value={form.urgency} onChange={set('urgency')}>
            {Object.entries(URGENCY).map(([k, u]) => (
              <option key={k} value={k}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" htmlFor="nr-desc" className="sm:col-span-2">
          <Textarea id="nr-desc" value={form.description} onChange={set('description')} placeholder="Ce que dit le client, accès, étage…" />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" variant="primary">
            Créer la demande
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
