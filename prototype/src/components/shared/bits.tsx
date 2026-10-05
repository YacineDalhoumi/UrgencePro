import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, Sparkles, Check, X } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { REQUEST_STATUS, QUOTE_STATUS, JOB_STATUS, INVOICE_STATUS, CALL_STATUS, URGENCY } from '@/data/reference'
import type { RequestStatus, QuoteStatus, JobStatus, InvoiceStatus, CallStatus, Urgency, PriceEstimate, Technician } from '@/data/types'
import { cn, money, money0, percent, initials } from '@/lib/utils'

export const RequestBadge = ({ s }: { s: RequestStatus }) => <Badge tone={REQUEST_STATUS[s].tone} dot>{REQUEST_STATUS[s].label}</Badge>
export const QuoteBadge = ({ s }: { s: QuoteStatus }) => <Badge tone={QUOTE_STATUS[s].tone}>{QUOTE_STATUS[s].label}</Badge>
export const JobBadge = ({ s }: { s: JobStatus }) => <Badge tone={JOB_STATUS[s].tone}>{JOB_STATUS[s].label}</Badge>
export const InvoiceBadge = ({ s }: { s: InvoiceStatus }) => <Badge tone={INVOICE_STATUS[s].tone}>{INVOICE_STATUS[s].label}</Badge>
export const CallBadge = ({ s }: { s: CallStatus }) => <Badge tone={CALL_STATUS[s].tone}>{CALL_STATUS[s].label}</Badge>

export function UrgencyBadge({ u }: { u: Urgency }) {
  if (u === 'absolue')
    return (
      <span className="inline-flex h-6 items-center gap-1.5 overflow-hidden rounded border border-accent/40 bg-accent-soft pr-2 text-[12px] font-bold text-accent">
        <span className="hazard h-full w-2.5" aria-hidden />
        {URGENCY[u].short}
      </span>
    )
  return <Badge tone={URGENCY[u].tone}>{URGENCY[u].short}</Badge>
}

export function AiBadge({ className, label = 'Proposé par l’IA' }: { className?: string; label?: string }) {
  return (
    <Badge tone="ai" className={className}>
      <Sparkles className="size-3.5" />
      {label}
    </Badge>
  )
}

export function TechChip({ tech, size = 24, showName = true }: { tech?: Technician; size?: number; showName?: boolean }) {
  if (!tech) return <span className="text-sm text-muted">Non affecté</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: tech.color, fontSize: size * 0.4 }}>
        {initials(tech.firstName, tech.lastName)}
      </span>
      {showName && <span className="truncate text-sm">{tech.firstName} {tech.lastName}</span>}
    </span>
  )
}

export function Delta({ value, invert, className }: { value: number | null; invert?: boolean; className?: string }) {
  if (value === null || !isFinite(value)) return <span className={cn('text-[12px] text-muted', className)}>—</span>
  const up = value >= 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[12px] font-semibold tnum', good ? 'text-ok' : 'text-bad', className)}>
      <Icon className="size-3.5" />
      {up ? '+' : ''}
      {percent(value)}
    </span>
  )
}

export function PriceRange({ est, className }: { est: Pick<PriceEstimate, 'minCents' | 'maxCents'>; className?: string }) {
  return (
    <span className={cn('tnum', className)}>
      {est.minCents === est.maxCents ? money0(est.minCents) : `${money0(est.minCents)} – ${money0(est.maxCents)}`}
    </span>
  )
}

export function PriceBreakdown({ est }: { est: PriceEstimate }) {
  return (
    <div className="text-sm">
      <table className="w-full">
        <tbody>
          {est.lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              <td className="py-1.5 pr-2">
                <span className={cn(l.kind === 'surcharge' && 'font-semibold text-accent')}>{l.label}</span>
                {l.detail && <span className="block text-[12px] text-muted">{l.detail}</span>}
              </td>
              <td className="whitespace-nowrap py-1.5 text-right tnum">
                {l.minCents === l.maxCents ? money(l.minCents) : `${money(l.minCents)} – ${money(l.maxCents)}`}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-2 font-bold">Fourchette TTC</td>
            <td className="whitespace-nowrap pt-2 text-right font-display text-base font-bold tnum">
              <PriceRange est={est} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function AiDecision({ onAccept, onReject, compact }: { onAccept: () => void; onReject: () => void; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size={compact ? 'sm' : 'md'} variant="ai" onClick={onAccept}>
        <Check /> Valider
      </Button>
      <Button size={compact ? 'sm' : 'md'} variant="secondary" onClick={onReject}>
        <X /> Rejeter
      </Button>
    </div>
  )
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden>
          <path
            d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z"
            fill={i <= Math.round(value) ? 'rgb(var(--warn))' : 'rgb(var(--border))'}
          />
        </svg>
      ))}
    </span>
  )
}

export function QrCode({ text, size = 180 }: { text: string; size?: number }) {
  const path = React.useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
    return { d, n }
  }, [text])
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} className="rounded bg-white" role="img" aria-label="QR code de paiement">
      <rect x={-2} y={-2} width={path.n + 4} height={path.n + 4} fill="#ffffff" />
      <path d={path.d} fill="#111111" />
    </svg>
  )
}

/** Pavé de signature tactile (canvas). */
export function SignaturePad({ onChange, height = 160 }: { onChange: (dataUrl: string | null) => void; height?: number }) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  const drawing = React.useRef(false)
  const dirty = React.useRef(false)

  React.useEffect(() => {
    const c = ref.current!
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio
    c.height = height * ratio
    const ctx = c.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1b2333'
  }, [height])

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  return (
    <div>
      <div className="relative rounded border-2 border-dashed border-border bg-white">
        <canvas
          ref={ref}
          style={{ height, width: '100%', touchAction: 'none' }}
          className="block cursor-crosshair"
          onPointerDown={(e) => {
            drawing.current = true
            const ctx = ref.current!.getContext('2d')!
            const p = pos(e)
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return
            const ctx = ref.current!.getContext('2d')!
            const p = pos(e)
            ctx.lineTo(p.x, p.y)
            ctx.stroke()
            dirty.current = true
          }}
          onPointerUp={() => {
            drawing.current = false
            if (dirty.current) onChange(ref.current!.toDataURL('image/png'))
          }}
          aria-label="Zone de signature"
        />
        <span className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">Signez avec le doigt ou la souris</span>
      </div>
      <button
        type="button"
        className="mt-1 text-[13px] font-semibold text-muted underline-offset-2 hover:underline"
        onClick={() => {
          const c = ref.current!
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
          dirty.current = false
          onChange(null)
        }}
      >
        Effacer
      </button>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Téléphone factice pour présenter les vues mobiles sur grand écran. */
export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-[400px] sm:rounded-[38px] sm:border-[10px] sm:border-ink sm:shadow-2xl', className)}>
      <div className="relative flex h-[calc(100dvh-120px)] min-h-[560px] flex-col overflow-hidden bg-bg sm:h-[760px] sm:rounded-[28px]">{children}</div>
    </div>
  )
}
