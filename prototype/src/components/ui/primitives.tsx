import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/data/reference'

// ——— Surfaces ———
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border border-border bg-surface', className)} {...p} />
}
export function CardHeader({ title, action, subtitle, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 pb-2', className)}>
      <div className="min-w-0">
        <h3 className="font-display text-[15px] font-bold leading-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ——— Badges ———
const toneClass: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted border-border',
  accent: 'bg-accent-soft text-accent border-accent/25',
  ok: 'bg-ok-soft text-ok border-ok/25',
  warn: 'bg-warn-soft text-warn border-warn/25',
  bad: 'bg-bad-soft text-bad border-bad/25',
  info: 'bg-info-soft text-info border-info/25',
  ai: 'bg-ai-soft text-ai border-ai/25',
}
export function Badge({ tone = 'neutral', className, dot, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded border px-2 text-[12px] font-semibold', toneClass[tone], className)} {...p}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {p.children}
    </span>
  )
}
export const toneText: Record<Tone, string> = { neutral: 'text-muted', accent: 'text-accent', ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', info: 'text-info', ai: 'text-ai' }
export const toneBg: Record<Tone, string> = { neutral: 'bg-muted', accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-info', ai: 'bg-ai' }

// ——— Formulaires ———
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn('h-10 w-full min-w-0 rounded border border-border bg-surface px-3 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none', className)} {...p} />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn('min-h-20 w-full rounded border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none', className)} {...p} />
))
Textarea.displayName = 'Textarea'

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('h-10 w-full min-w-0 rounded border border-border bg-surface px-2.5 text-sm focus:border-accent focus:outline-none', className)} {...p} />
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  )
}

export function Switch({ checked, onCheckedChange, id, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; id?: string; label?: string }) {
  return (
    <SwitchPrimitive.Root
      id={id}
      aria-label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border bg-sunken transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent"
    >
      <SwitchPrimitive.Thumb className="block size-[18px] translate-x-[2px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  )
}

// ——— Onglets ———
export const Tabs = TabsPrimitive.Root
export function TabsList({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('scroll-thin flex max-w-full gap-1 overflow-x-auto border-b border-border', className)} {...p} />
}
export function TabsTrigger({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn('-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-muted hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg', className)}
      {...p}
    />
  )
}
export const TabsContent = TabsPrimitive.Content

// ——— Fenêtres ———
export function Dialog({ open, onOpenChange, title, description, children, wide, side }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children: React.ReactNode; wide?: boolean; side?: boolean }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col border border-border bg-surface shadow-2xl focus:outline-none',
            side
              ? 'inset-y-0 right-0 w-full max-w-xl'
              : cn('left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg', wide ? 'max-w-3xl' : 'max-w-lg'),
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <DialogPrimitive.Title className="font-display text-lg font-bold">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="rounded p-1 text-muted hover:bg-sunken hover:text-fg" aria-label="Fermer">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ——— Divers ———
export function Avatar({ text, color, size = 32, className }: { text: string; color?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', !color && 'bg-muted', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: color }}
      aria-hidden
    >
      {text}
    </span>
  )
}

export function Empty({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="text-muted [&_svg]:size-8">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-sunken px-1.5 font-mono text-[11px] text-muted">{children}</kbd>
}
