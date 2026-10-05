import * as React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Inbox, Phone, CalendarDays, Map as MapIcon, Users, FileText, Receipt, HardHat, BookOpen, ChartColumn, Star, Settings,
  Menu, X, Search, PhoneIncoming, Bell, Moon, Sun, Monitor, RotateCcw, Smartphone, UserRound, Webhook, Rocket,
} from 'lucide-react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { useStore } from '@/store/store'
import { useDs } from '@/store/hooks'
import { cn, phone as fmtPhone, dateTimeFr } from '@/lib/utils'
import { COMPANY_IDS } from '@/data/generate'
import { Button } from '@/components/ui/button'
import { IncomingCallCard } from './IncomingCall'

/** Barre de démonstration : bascule entre les trois interfaces, l'entreprise et le thème. */
export function DemoBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const data = useStore((s) => s.data)
  const companyId = useStore((s) => s.companyId)
  const setCompany = useStore((s) => s.setCompany)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const reset = useStore((s) => s.reset)
  const space = pathname.startsWith('/tech') ? 'tech' : pathname.startsWith('/client') ? 'client' : 'bo'
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  const spaces = [
    { key: 'bo', label: 'Back-office', short: 'Bureau', icon: LayoutDashboard, to: '/tableau-de-bord' },
    { key: 'tech', label: 'Appli technicien', short: 'Tech', icon: Smartphone, to: '/tech' },
    { key: 'client', label: 'Parcours client', short: 'Client', icon: UserRound, to: '/client' },
  ]

  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-ink text-ink-fg" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex h-12 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-accent font-display text-sm font-extrabold text-accent-fg">U</span>
          <span className="hidden font-display text-[15px] font-bold sm:inline">UrgencePro</span>
          <span className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-ink-fg/80 lg:inline">Prototype · données fictives</span>
        </div>
        <nav className="mx-auto flex rounded-md bg-white/10 p-0.5" aria-label="Interfaces">
          {spaces.map((s) => (
            <button
              key={s.key}
              onClick={() => navigate(s.to)}
              className={cn('flex h-8 items-center gap-1.5 rounded px-2.5 text-[13px] font-semibold transition-colors sm:px-3', space === s.key ? 'bg-surface text-fg' : 'text-ink-fg/75 hover:text-ink-fg')}
            >
              <s.icon className="size-4" />
              <span className="hidden md:inline">{s.label}</span>
              <span className="md:hidden">{s.short}</span>
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <select
            aria-label="Entreprise de démonstration"
            value={companyId}
            onChange={(e) => setCompany(e.target.value)}
            className="hidden h-8 max-w-[200px] rounded border border-white/15 bg-white/10 px-2 text-[13px] font-semibold text-ink-fg sm:block [&>option]:text-black"
          >
            {COMPANY_IDS.map((id) => (
              <option key={id} value={id}>
                {data[id].company.name}
              </option>
            ))}
          </select>
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <button className="inline-flex size-8 items-center justify-center rounded text-ink-fg/80 hover:bg-white/10" aria-label="Options de la démo">
                <ThemeIcon className="size-4" />
              </button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" sideOffset={6} className="z-50 min-w-[230px] rounded-md border border-border bg-surface p-1 text-fg shadow-xl">
                <div className="px-2 py-1.5 label-caps text-muted">Entreprise</div>
                {COMPANY_IDS.map((id) => (
                  <Dropdown.Item key={id} onSelect={() => setCompany(id)} className={cn('cursor-pointer rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-sunken', id === companyId && 'font-bold')}>
                    {data[id].company.name}
                  </Dropdown.Item>
                ))}
                <Dropdown.Separator className="my-1 h-px bg-border" />
                <div className="px-2 py-1.5 label-caps text-muted">Thème</div>
                {(
                  [
                    ['system', 'Automatique', Monitor],
                    ['light', 'Clair', Sun],
                    ['dark', 'Sombre', Moon],
                  ] as const
                ).map(([k, l, I]) => (
                  <Dropdown.Item key={k} onSelect={() => setTheme(k)} className={cn('flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-sunken', theme === k && 'font-bold')}>
                    <I className="size-4" /> {l}
                  </Dropdown.Item>
                ))}
                <Dropdown.Separator className="my-1 h-px bg-border" />
                <Dropdown.Item onSelect={() => navigate('/onboarding')} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-sunken">
                  <Rocket className="size-4" /> Voir l’onboarding
                </Dropdown.Item>
                <Dropdown.Item onSelect={reset} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-bad outline-none data-[highlighted]:bg-sunken">
                  <RotateCcw className="size-4" /> Réinitialiser la démo
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        </div>
      </div>
    </div>
  )
}

function useNavCounts() {
  const ds = useDs()
  return React.useMemo(() => {
    const dayStart = new Date().setHours(0, 0, 0, 0)
    return {
      demandes: ds.requests.filter((r) => r.status === 'nouvelle').length,
      appels: ds.calls.filter((c) => c.at >= dayStart && (c.status === 'manque' || c.status === 'messagerie')).length,
      planning: ds.jobs.filter((j) => j.status === 'a_planifier').length,
      factures: ds.invoices.filter((i) => i.status === 'en_retard').length,
    }
  }, [ds.requests, ds.calls, ds.jobs, ds.invoices])
}

const NAV = [
  { group: 'Activité', items: [
    { to: '/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/demandes', label: 'Demandes', icon: Inbox, count: 'demandes' },
    { to: '/appels', label: 'Appels', icon: Phone, count: 'appels' },
    { to: '/planning', label: 'Planning', icon: CalendarDays, count: 'planning' },
    { to: '/carte', label: 'Carte en direct', icon: MapIcon },
  ] },
  { group: 'Gestion', items: [
    { to: '/clients', label: 'Clients', icon: Users },
    { to: '/devis', label: 'Devis', icon: FileText },
    { to: '/factures', label: 'Factures', icon: Receipt, count: 'factures' },
    { to: '/techniciens', label: 'Techniciens', icon: HardHat },
    { to: '/catalogue', label: 'Catalogue et tarifs', icon: BookOpen },
  ] },
  { group: 'Pilotage', items: [
    { to: '/statistiques', label: 'Statistiques', icon: ChartColumn },
    { to: '/avis', label: 'Avis', icon: Star },
    { to: '/parametres', label: 'Paramètres', icon: Settings },
    { to: '/parametres/integrations', label: 'API et webhooks', icon: Webhook },
  ] },
] as const

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const counts = useNavCounts()
  const ds = useDs()
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <div className="label-caps text-ink-fg/50">Entreprise</div>
        <div className="mt-0.5 truncate font-display text-[15px] font-bold">{ds.company.name}</div>
        <div className="text-[12px] text-ink-fg/60 tnum">Standard {fmtPhone(ds.company.phone)}</div>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-2 pb-4">
        {NAV.map((g) => (
          <div key={g.group} className="mt-3">
            <div className="px-2 pb-1 label-caps text-ink-fg/45">{g.group}</div>
            {g.items.map((it) => {
              const c = 'count' in it ? counts[it.count as keyof typeof counts] : 0
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === '/parametres'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn('flex h-10 items-center gap-3 rounded px-2.5 text-[14px] font-semibold transition-colors', isActive ? 'bg-white/15 text-white' : 'text-ink-fg/75 hover:bg-white/5 hover:text-ink-fg')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <it.icon className={cn('size-[18px]', isActive && 'text-accent')} />
                      <span className="flex-1 truncate">{it.label}</span>
                      {c > 0 && <span className={cn('min-w-6 rounded px-1.5 text-center text-[12px] font-bold tnum', it.to === '/factures' ? 'bg-bad/90 text-white' : 'bg-accent text-accent-fg')}>{c}</span>}
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-3 text-[12px] text-ink-fg/60">
        Connectée : <span className="font-semibold text-ink-fg/85">Sandrine</span> · Dispatcher
      </div>
    </div>
  )
}

function GlobalSearch() {
  const ds = useDs()
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const results = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    const digits = t.replace(/\D/g, '')
    const clients = ds.clients
      .filter((c) => `${c.firstName} ${c.lastName} ${c.companyName ?? ''}`.toLowerCase().includes(t) || (digits.length >= 3 && c.phone.replace('+33', '0').includes(digits)))
      .slice(0, 5)
      .map((c) => ({ key: c.id, label: c.companyName ?? `${c.firstName} ${c.lastName}`, sub: fmtPhone(c.phone), to: `/clients/${c.id}` }))
    const reqs = ds.requests
      .filter((r) => r.ref.toLowerCase().includes(t))
      .slice(0, 5)
      .map((r) => ({ key: r.id, label: r.ref, sub: dateTimeFr(r.createdAt), to: `/demandes/${r.id}` }))
    return [...reqs, ...clients]
  }, [q, ds.clients, ds.requests])
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        id="global-search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Client, téléphone ou n° de demande…"
        className="h-10 w-full rounded border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-md border border-border bg-surface shadow-xl">
          {results.map((r) => (
            <button
              key={r.key}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sunken"
              onMouseDown={() => {
                navigate(r.to)
                setQ('')
              }}
            >
              <span className="truncate font-semibold">{r.label}</span>
              <span className="shrink-0 text-[12px] text-muted tnum">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EventsBell() {
  const ds = useDs()
  const recent = ds.events.slice(0, 8)
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="relative inline-flex size-10 items-center justify-center rounded border border-border bg-surface text-muted hover:text-fg" aria-label="Notifications">
          <Bell className="size-[18px]" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-accent" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6} className="z-50 w-[340px] max-w-[calc(100vw-32px)] rounded-md border border-border bg-surface p-1 text-fg shadow-xl">
          <div className="px-2 py-1.5 label-caps text-muted">Activité récente</div>
          {recent.map((e) => (
            <div key={e.id} className="rounded px-2 py-1.5 text-[13px]">
              <div className="font-semibold leading-snug">{e.summary}</div>
              <div className="text-[12px] text-muted">
                <span className="font-mono">{e.type}</span> · {dateTimeFr(e.at)}
              </div>
            </div>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

export function BackOffice() {
  const [open, setOpen] = React.useState(false)
  const simulateCall = useStore((s) => s.simulateCall)
  const incoming = useStore((s) => s.incoming)
  const { pathname } = useLocation()
  React.useEffect(() => setOpen(false), [pathname])

  return (
    <div className="flex min-h-[calc(100dvh-48px)]">
      <aside className="sticky top-12 hidden h-[calc(100dvh-48px)] w-[248px] shrink-0 bg-ink text-ink-fg lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-ink text-ink-fg shadow-2xl">
            <button className="absolute right-2 top-3 rounded p-1.5 text-ink-fg/70 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Fermer le menu">
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-12 z-30 flex h-16 items-center gap-2 border-b border-border bg-bg/95 px-4 backdrop-blur sm:gap-3 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu />
          </Button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" onClick={() => simulateCall(Math.random() < 0.6)} disabled={!!incoming} title="Simule un appel entrant sur le standard Twilio">
              <PhoneIncoming />
              <span className="hidden sm:inline">Simuler un appel</span>
            </Button>
            <EventsBell />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>
      <IncomingCallCard />
    </div>
  )
}
