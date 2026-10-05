import * as React from 'react'
import { Link } from 'react-router-dom'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { GripVertical, Moon } from 'lucide-react'
import { useStore } from '@/store/store'
import { useLookups } from '@/store/hooks'
import { Badge, Card } from '@/components/ui/primitives'
import { JobBadge, PageHeader, PriceRange, TechChip, UrgencyBadge } from '@/components/shared/bits'
import { problemByCode } from '@/data/reference'
import type { Job, ServiceRequest } from '@/data/types'
import { cn, dateFr, timeFr, DAY, HOUR, MINUTE } from '@/lib/utils'

const START_H = 7
const END_H = 23
const PX_PER_H = 60

export function PlanningPage() {
  const [view, setView] = React.useState<'jour' | 'semaine'>('jour')
  return (
    <div>
      <PageHeader
        title="Planning"
        subtitle={`${dateFr(Date.now(), 'EEEE d MMMM yyyy')} · glissez une intervention sur la colonne d’un technicien`}
        actions={
          <div className="flex rounded border border-border bg-surface p-0.5">
            {(['jour', 'semaine'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn('h-8 rounded px-3 text-[13px] font-semibold capitalize', view === v ? 'bg-ink text-ink-fg' : 'text-muted hover:text-fg')}>
                {v}
              </button>
            ))}
          </div>
        }
      />
      {view === 'jour' ? <DayView /> : <WeekView />}
    </div>
  )
}

interface DragData {
  requestId: string
  durationMin: number
}

function DayView() {
  const { ds, requests } = useLookups()
  const assignJob = useStore((s) => s.assignJob)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const day0 = new Date().setHours(0, 0, 0, 0)
  const techs = ds.technicians
  const jobsToday = ds.jobs.filter((j) => j.technicianId && j.start >= day0 + (START_H - 1) * HOUR && j.start < day0 + DAY && j.status !== 'annulee')
  const queue = React.useMemo(() => {
    const fromJobs = ds.jobs.filter((j) => j.status === 'a_planifier').map((j) => requests.get(j.requestId)!).filter(Boolean)
    const qualified = ds.requests.filter((r) => r.status === 'qualifiee' && !r.jobId && r.createdAt > Date.now() - 2 * DAY)
    return [...fromJobs, ...qualified]
  }, [ds.jobs, ds.requests, requests])
  const nowY = ((Date.now() - day0) / HOUR - START_H) * PX_PER_H
  const scroller = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, nowY - 160)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDragEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as DragData | undefined
    const over = e.over
    const translated = e.active.rect.current.translated
    if (!data || !over || !translated) return
    const y = translated.top - over.rect.top
    let minutes = Math.round(((y / PX_PER_H) * 60) / 15) * 15
    minutes = Math.max(0, Math.min((END_H - START_H) * 60 - 30, minutes))
    const start = day0 + START_H * HOUR + minutes * MINUTE
    assignJob(data.requestId, String(over.id), start)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h3 className="font-display text-[15px] font-bold">À planifier</h3>
            <Badge tone={queue.length ? 'warn' : 'neutral'}>{queue.length}</Badge>
          </div>
          <div className="space-y-2 px-3 pb-3">
            {queue.length === 0 && <p className="px-1 py-4 text-center text-sm text-muted">Tout est planifié.</p>}
            {queue.map((r) => (
              <QueueCard key={r.id} req={r} />
            ))}
          </div>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <div className="min-w-[780px]">
              <div className="grid border-b border-border bg-sunken" style={{ gridTemplateColumns: `56px repeat(${techs.length}, minmax(120px, 1fr))` }}>
                <div />
                {techs.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 border-l border-border px-2 py-2.5">
                    <TechChip tech={t} size={26} showName={false} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold">{t.firstName}</div>
                      <div className="text-[11px] text-muted">
                        {jobsToday.filter((j) => j.technicianId === t.id).length} missions
                        {t.onCall && (
                          <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-accent">
                            <Moon className="size-3" /> astreinte
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div ref={scroller} className="scroll-thin relative max-h-[calc(100dvh-300px)] min-h-[420px] overflow-y-auto">
                <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${techs.length}, minmax(120px, 1fr))`, height: (END_H - START_H) * PX_PER_H }}>
                  <div className="relative">
                    {Array.from({ length: END_H - START_H }, (_, i) => (
                      <div key={i} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tnum" style={{ top: i * PX_PER_H }}>
                        {i ? `${START_H + i} h` : ''}
                      </div>
                    ))}
                  </div>
                  {techs.map((t, ti) => (
                    <TechColumn key={t.id} techId={t.id}>
                      {Array.from({ length: END_H - START_H }, (_, i) => (
                        <div key={i} className="absolute inset-x-0 border-t border-border/60" style={{ top: i * PX_PER_H }} />
                      ))}
                      {/* Indisponibilités (pauses, formation) */}
                      <Unavailable top={(12.5 - START_H) * PX_PER_H} height={PX_PER_H} label="Pause" />
                      {ti === techs.length - 1 && <Unavailable top={(14 - START_H) * PX_PER_H} height={3 * PX_PER_H} label="Formation" />}
                      {jobsToday
                        .filter((j) => j.technicianId === t.id)
                        .map((j) => (
                          <JobBlock key={j.id} job={j} req={requests.get(j.requestId)} color={t.color} />
                        ))}
                    </TechColumn>
                  ))}
                  {nowY > 0 && nowY < (END_H - START_H) * PX_PER_H && (
                    <div className="pointer-events-none absolute left-[56px] right-0 z-10 border-t-2 border-bad" style={{ top: nowY }}>
                      <span className="absolute -left-[52px] -top-2.5 rounded bg-bad px-1 text-[10px] font-bold text-white tnum">{timeFr(Date.now())}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DndContext>
  )
}

function TechColumn({ techId, children }: { techId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: techId })
  return (
    <div ref={setNodeRef} className={cn('relative border-l border-border', isOver && 'bg-accent-soft/40')}>
      {children}
    </div>
  )
}

function Unavailable({ top, height, label }: { top: number; height: number; label: string }) {
  return (
    <div
      className="absolute inset-x-1 rounded-sm text-[11px] font-semibold text-muted"
      style={{ top, height, backgroundImage: 'repeating-linear-gradient(135deg, rgb(var(--border)) 0 2px, transparent 2px 9px)' }}
    >
      <span className="m-1 inline-block rounded bg-surface px-1">{label}</span>
    </div>
  )
}

function QueueCard({ req }: { req: ServiceRequest }) {
  const { clients } = useLookups()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `q-${req.id}`, data: { requestId: req.id, durationMin: req.durationMin } satisfies DragData })
  const c = clients.get(req.clientId)
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn('relative z-20 cursor-grab rounded border border-border bg-surface p-2.5 text-sm shadow-sm', isDragging && 'opacity-90 shadow-xl')}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{problemByCode[req.problemTypeCode]?.label}</span>
            <UrgencyBadge u={req.urgency} />
          </div>
          <div className="text-[12px] text-muted">
            {c?.firstName} {c?.lastName} · {c?.addresses.find((a) => a.id === req.addressId)?.city}
          </div>
          <div className="mt-1 flex items-center justify-between text-[12px]">
            <Link to={`/demandes/${req.id}`} className="font-mono text-accent hover:underline" onPointerDown={(e) => e.stopPropagation()}>
              {req.ref}
            </Link>
            <span className="font-semibold">
              <PriceRange est={req.estimate} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function JobBlock({ job, req, color }: { job: Job; req?: ServiceRequest; color: string }) {
  const day0 = new Date().setHours(0, 0, 0, 0)
  const movable = ['proposee', 'acceptee', 'a_planifier'].includes(job.status)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `j-${job.id}`, data: { requestId: job.requestId, durationMin: job.durationMin } satisfies DragData, disabled: !movable })
  const top = ((job.start - day0) / HOUR - START_H) * PX_PER_H
  const height = Math.max(34, (job.durationMin / 60) * PX_PER_H)
  if (!req) return null
  const done = job.status === 'terminee'
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn('absolute inset-x-1 overflow-hidden rounded border-l-4 px-2 py-1 text-[12px] shadow-sm', movable ? 'cursor-grab' : 'cursor-default', isDragging && 'z-30 shadow-xl', done ? 'bg-sunken text-muted' : 'bg-surface')}
      style={{ top, height, borderLeftColor: color, transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, outline: done ? undefined : `1px solid ${color}33` }}
      title={`${req.ref} — ${problemByCode[req.problemTypeCode]?.label}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-bold">{timeFr(job.start)} · {problemByCode[req.problemTypeCode]?.label}</span>
      </div>
      {height > 44 && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <JobBadge s={job.status} />
        </div>
      )}
      {height > 70 && (
        <Link to={`/demandes/${req.id}`} className="mt-0.5 block truncate font-mono text-[11px] text-accent hover:underline" onPointerDown={(e) => e.stopPropagation()}>
          {req.ref}
        </Link>
      )}
    </div>
  )
}

function WeekView() {
  const { ds } = useLookups()
  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => monday.getTime() + i * DAY)
  return (
    <Card className="overflow-hidden">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-sunken text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Technicien</th>
              {days.map((d) => (
                <th key={d} className={cn('px-2 py-2.5 text-left font-semibold capitalize', new Date(d).toDateString() === new Date().toDateString() && 'text-accent')}>
                  {dateFr(d, 'EEE d')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ds.technicians.map((t) => (
              <tr key={t.id} className="border-t border-border align-top">
                <td className="px-3 py-2.5">
                  <TechChip tech={t} />
                </td>
                {days.map((d) => {
                  const js = ds.jobs.filter((j) => j.technicianId === t.id && j.start >= d && j.start < d + DAY)
                  return (
                    <td key={d} className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        {js.slice(0, 3).map((j) => (
                          <span key={j.id} className="truncate rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: `${t.color}22`, color: t.color }}>
                            {timeFr(j.start)} {problemByCode[ds.requests.find((r) => r.id === j.requestId)?.problemTypeCode ?? '']?.label}
                          </span>
                        ))}
                        {js.length > 3 && <span className="text-[11px] text-muted">+{js.length - 3}</span>}
                        {js.length === 0 && <span className="text-[11px] text-muted">—</span>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
