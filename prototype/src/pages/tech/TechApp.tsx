// Application technicien (PWA) — présentée dans un cadre de téléphone sur grand écran.
import * as React from 'react'
import { ChevronLeft, Navigation, Phone, MapPin, KeyRound, Camera, Check, X, Wifi, WifiOff, CloudUpload, Bell, Banknote, CreditCard, QrCode as QrIcon, FileSignature, Minus, Plus, Package } from 'lucide-react'
import { useStore } from '@/store/store'
import { useLookups, addressOf } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Badge, Field, Input, Textarea } from '@/components/ui/primitives'
import { JobBadge, PhoneFrame, QrCode, SignaturePad, TechChip, UrgencyBadge, PriceRange } from '@/components/shared/bits'
import { MediaArt } from '@/components/shared/MediaArt'
import { problemByCode, catalogByCode, HOUSING_LABEL } from '@/data/reference'
import { totals } from '@/data/pricing'
import type { Job, Media, PaymentMethod } from '@/data/types'
import { cn, money, phone, timeFr, uid, DAY } from '@/lib/utils'

type Screen = { name: 'missions' } | { name: 'detail'; jobId: string } | { name: 'rapport'; jobId: string } | { name: 'signature'; jobId: string; target: 'rapport' | 'devis' } | { name: 'encaissement'; jobId: string }

export function TechApp() {
  const { ds } = useLookups()
  const techId = useStore((s) => s.techId)
  const setTech = useStore((s) => s.setTech)
  const offline = useStore((s) => s.offline)
  const setOffline = useStore((s) => s.setOffline)
  const queue = useStore((s) => s.queue)
  const [screen, setScreen] = React.useState<Screen>({ name: 'missions' })
  const tech = ds.technicians.find((t) => t.id === techId) ?? ds.technicians[0]
  React.useEffect(() => setScreen({ name: 'missions' }), [tech.id])

  return (
    <div className="px-4 py-4 sm:py-8">
      <div className="mx-auto mb-4 flex max-w-[400px] flex-wrap items-center justify-between gap-2">
        <label htmlFor="tech-select" className="text-[13px] font-semibold text-muted">
          Vous êtes
        </label>
        <select id="tech-select" value={tech.id} onChange={(e) => setTech(e.target.value)} className="h-9 flex-1 rounded border border-border bg-surface px-2 text-sm font-semibold">
          {ds.technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName}
              {ds.jobs.some((j) => j.technicianId === t.id && j.status === 'proposee') ? ' · nouvelle mission' : ''}
              {ds.jobs.some((j) => j.technicianId === t.id && j.status === 'en_route') ? ' · en route' : ''}
            </option>
          ))}
        </select>
      </div>
      <PhoneFrame>
        <div className="flex items-center justify-between bg-ink px-4 pb-2.5 pt-3 text-ink-fg">
          <TechChip tech={tech} size={28} />
          <button onClick={() => setOffline(!offline)} className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold', offline ? 'bg-warn text-black' : 'bg-white/10')} aria-pressed={offline}>
            {offline ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
            {offline ? `Hors ligne${queue.length ? ` · ${queue.length} en attente` : ''}` : 'En ligne'}
          </button>
        </div>
        {offline && (
          <div className="flex items-center gap-2 bg-warn-soft px-4 py-2 text-[12px] text-warn">
            <CloudUpload className="size-4" /> Les actions sont enregistrées sur le téléphone et seront synchronisées au retour du réseau.
          </div>
        )}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {screen.name === 'missions' && <Missions techId={tech.id} open={(jobId) => setScreen({ name: 'detail', jobId })} />}
          {screen.name === 'detail' && <Detail jobId={screen.jobId} go={setScreen} />}
          {screen.name === 'rapport' && <Report jobId={screen.jobId} go={setScreen} />}
          {screen.name === 'signature' && <Signature jobId={screen.jobId} target={screen.target} go={setScreen} />}
          {screen.name === 'encaissement' && <Payment jobId={screen.jobId} go={setScreen} />}
        </div>
      </PhoneFrame>
      <p className="mx-auto mt-4 max-w-[400px] text-center text-[12px] text-muted">Application installable (PWA) : notifications push, fonctionnement hors connexion, partage de position pendant le service uniquement.</p>
    </div>
  )
}

function Missions({ techId, open }: { techId: string; open: (id: string) => void }) {
  const { ds, requests, clients } = useLookups()
  const respond = useStore((s) => s.techRespond)
  const day0 = new Date().setHours(0, 0, 0, 0)
  const jobs = ds.jobs.filter((j) => j.technicianId === techId && j.start >= day0 - DAY / 2 && j.start < day0 + 2 * DAY && j.status !== 'annulee').sort((a, b) => a.start - b.start)
  const active = jobs.filter((j) => j.status !== 'terminee')
  const done = jobs.filter((j) => j.status === 'terminee')
  const offered = active.filter((j) => j.status === 'proposee')
  const card = (j: Job) => {
    const r = requests.get(j.requestId)!
    const c = clients.get(r.clientId)!
    const a = c.addresses.find((x) => x.id === r.addressId)
    return (
      <button key={j.id} onClick={() => open(j.id)} className={cn('w-full rounded-lg border bg-surface p-3 text-left', j.status === 'en_route' || j.status === 'sur_place' ? 'border-accent' : 'border-border')}>
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-extrabold tnum">{timeFr(j.start)}</span>
          <JobBadge s={j.status} />
        </div>
        <div className="mt-1 font-semibold">{problemByCode[r.problemTypeCode]?.label}</div>
        <div className="text-[13px] text-muted">
          {a?.line1}, {a?.city}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <UrgencyBadge u={r.urgency} />
          {j.status === 'en_route' && <span className="text-[13px] font-bold text-accent">Arrivée dans {j.etaMin} min</span>}
        </div>
      </button>
    )
  }
  return (
    <div className="space-y-3 p-4">
      {offered.map((j) => {
        const r = requests.get(j.requestId)!
        return (
          <div key={j.id} className="rounded-lg border-2 border-accent bg-accent-soft p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-accent">
              <Bell className="size-4" /> Nouvelle mission
            </div>
            <div className="mt-1 font-semibold">
              {problemByCode[r.problemTypeCode]?.label} · {timeFr(j.start)}
            </div>
            <div className="text-[13px]">
              {clients.get(r.clientId)?.addresses.find((x) => x.id === r.addressId)?.city} · <PriceRange est={r.estimate} /> TTC annoncés
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="ok" size="lg" onClick={() => respond(j.id, true)}>
                <Check /> Accepter
              </Button>
              <Button size="lg" onClick={() => respond(j.id, false)}>
                <X /> Refuser
              </Button>
            </div>
          </div>
        )
      })}
      <h2 className="pt-1 font-display text-lg font-bold">Mes missions</h2>
      {active.filter((j) => j.status !== 'proposee').length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">Aucune mission en cours.</p>}
      {active.filter((j) => j.status !== 'proposee').map(card)}
      {done.length > 0 && (
        <>
          <h2 className="pt-2 font-display text-base font-bold text-muted">Terminées</h2>
          {done.map(card)}
        </>
      )}
    </div>
  )
}

function Top({ title, back }: { title: string; back: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-2 py-2">
      <Button size="icon" variant="ghost" onClick={back} aria-label="Retour">
        <ChevronLeft />
      </Button>
      <h2 className="truncate font-display text-base font-bold">{title}</h2>
    </div>
  )
}

function Detail({ jobId, go }: { jobId: string; go: (s: Screen) => void }) {
  const { ds, jobs, requests, clients, quotes } = useLookups()
  const techStatus = useStore((s) => s.techStatus)
  const respond = useStore((s) => s.techRespond)
  const job = jobs.get(jobId)!
  const r = requests.get(job.requestId)!
  const c = clients.get(r.clientId)!
  const a = addressOf(ds, r.clientId, r.addressId)!
  const q = r.quoteId ? quotes.get(r.quoteId) : undefined
  const dest = encodeURIComponent(`${a.line1}, ${a.postalCode} ${a.city}`)
  return (
    <div>
      <Top title={problemByCode[r.problemTypeCode]?.label} back={() => go({ name: 'missions' })} />
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <JobBadge s={job.status} />
          <UrgencyBadge u={r.urgency} />
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="font-semibold">
            {c.firstName} {c.lastName}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm tnum">
            <Phone className="size-4 text-muted" /> <span className="select-all">{phone(c.phone)}</span>
          </div>
          <div className="mt-1 flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>
              {a.line1}, {a.postalCode} {a.city}
              <span className="block text-[13px] text-muted">
                {HOUSING_LABEL[a.housingType]}
                {a.floor && ` · ${a.floor}`}
              </span>
            </span>
          </div>
          {(a.doorCode || a.intercom || a.accessNotes) && (
            <div className="mt-2 flex items-start gap-2 rounded bg-sunken p-2 text-[13px]">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>
                {a.doorCode && <>Code <b className="font-mono">{a.doorCode}</b> · </>}
                {a.intercom && <>Interphone {a.intercom}</>}
                {a.accessNotes && <span className="block">{a.accessNotes}</span>}
              </span>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded border border-border text-sm font-semibold hover:bg-sunken">
              <Navigation className="size-4" /> Google Maps
            </a>
            <a href={`https://waze.com/ul?q=${dest}&navigate=yes`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded border border-border text-sm font-semibold hover:bg-sunken">
              <Navigation className="size-4" /> Waze
            </a>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-sm">
          <div className="label-caps text-muted">Description du client</div>
          <p className="mt-1">{r.description}</p>
          <div className="mt-2 flex items-center justify-between text-[13px]">
            <span className="text-muted">Prix annoncé</span>
            <b>
              <PriceRange est={r.estimate} /> TTC
            </b>
          </div>
          {q && (
            <div className="mt-1 flex items-center justify-between text-[13px]">
              <span className="text-muted">Devis {q.ref}</span>
              <b className={q.status === 'signe' ? 'text-ok' : ''}>
                {money(totals(q.lines).ttc)} · {q.status === 'signe' ? 'signé' : 'non signé'}
              </b>
            </div>
          )}
        </div>
        {r.media.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {r.media.slice(0, 6).map((m) => (
              <div key={m.id} className="aspect-square overflow-hidden rounded">
                <MediaArt media={m} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="sticky bottom-0 space-y-2 border-t border-border bg-surface p-3">
        {job.status === 'proposee' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ok" size="xl" onClick={() => respond(job.id, true)}>
              <Check /> Accepter
            </Button>
            <Button size="xl" onClick={() => respond(job.id, false)}>
              Refuser
            </Button>
          </div>
        )}
        {job.status === 'acceptee' && (
          <Button variant="primary" size="xl" className="w-full" onClick={() => techStatus(job.id, 'en_route')}>
            <Navigation /> En route
          </Button>
        )}
        {job.status === 'en_route' && (
          <Button variant="primary" size="xl" className="w-full" onClick={() => techStatus(job.id, 'sur_place')}>
            <MapPin /> Je suis sur place
          </Button>
        )}
        {job.status === 'sur_place' && (
          <>
            {q && q.status !== 'signe' && (
              <Button size="lg" className="w-full" onClick={() => go({ name: 'signature', jobId, target: 'devis' })}>
                <FileSignature /> Faire signer le devis
              </Button>
            )}
            <Button variant="primary" size="xl" className="w-full" onClick={() => go({ name: 'rapport', jobId })}>
              <Check /> Terminer : rapport d’intervention
            </Button>
          </>
        )}
        {job.status === 'terminee' && (
          <Button variant="ok" size="xl" className="w-full" onClick={() => go({ name: 'encaissement', jobId })}>
            <Banknote /> Encaisser
          </Button>
        )}
      </div>
    </div>
  )
}

function Report({ jobId, go }: { jobId: string; go: (s: Screen) => void }) {
  const { ds, jobs, requests } = useLookups()
  const save = useStore((s) => s.saveReport)
  const techStatus = useStore((s) => s.techStatus)
  const job = jobs.get(jobId)!
  const r = requests.get(job.requestId)!
  const stock = ds.stock.filter((s) => s.technicianId === job.technicianId)
  const [photos, setPhotos] = React.useState<Media[]>([])
  const [work, setWork] = React.useState(`${problemByCode[r.problemTypeCode]?.label} : intervention réalisée.`)
  const [obs, setObs] = React.useState('')
  const [parts, setParts] = React.useState<Record<string, number>>({})
  const [duration, setDuration] = React.useState(Math.round(job.arrivedAt ? Math.max(15, (Date.now() - job.arrivedAt) / 60000) : job.durationMin))
  const addPhotos = (files: FileList | null, category: 'avant' | 'apres') => {
    if (!files) return
    setPhotos((p) => [...p, ...Array.from(files).slice(0, 10).map((f) => ({ id: uid('med'), requestId: r.id, kind: 'photo' as const, category, caption: category === 'avant' ? 'Avant' : 'Après', src: URL.createObjectURL(f), at: Date.now() }))])
  }
  return (
    <div>
      <Top title="Rapport d’intervention" back={() => go({ name: 'detail', jobId })} />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          {(['avant', 'apres'] as const).map((cat) => (
            <label key={cat} className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-sm font-semibold text-muted hover:border-accent">
              <Camera className="size-5" /> Photos {cat === 'avant' ? 'avant' : 'après'}
              <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files, cat)} />
            </label>
          ))}
        </div>
        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {photos.map((m) => (
              <div key={m.id} className="relative aspect-square overflow-hidden rounded">
                <MediaArt media={m} />
                <span className="absolute bottom-0 left-0 bg-black/60 px-1 text-[10px] text-white">{m.caption}</span>
              </div>
            ))}
          </div>
        )}
        <Field label="Travaux réalisés" htmlFor="rep-work">
          <Textarea id="rep-work" value={work} onChange={(e) => setWork(e.target.value)} />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
            <Package className="size-4" /> Pièces utilisées (stock véhicule)
          </div>
          <div className="space-y-1.5">
            {stock.map((s) => (
              <div key={s.code} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5 text-[13px]">
                <span className="min-w-0 truncate">
                  {catalogByCode[s.code]?.label}
                  <span className="block text-[11px] text-muted">{s.qty} en stock</span>
                </span>
                <span className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Moins" onClick={() => setParts((p) => ({ ...p, [s.code]: Math.max(0, (p[s.code] ?? 0) - 1) }))}>
                    <Minus />
                  </Button>
                  <span className="w-5 text-center font-bold tnum">{parts[s.code] ?? 0}</span>
                  <Button size="icon-sm" variant="ghost" aria-label="Plus" onClick={() => setParts((p) => ({ ...p, [s.code]: Math.min(s.qty, (p[s.code] ?? 0) + 1) }))}>
                    <Plus />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </div>
        <Field label="Durée réelle (min)" htmlFor="rep-dur">
          <Input id="rep-dur" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </Field>
        <Field label="Observations et recommandations" htmlFor="rep-obs">
          <Textarea id="rep-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex. : prévoir le remplacement de la serrure 3 points" />
        </Field>
      </div>
      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          onClick={() => {
            save(job.id, { workDone: work, observations: obs, parts: Object.entries(parts).filter(([, q]) => q > 0).map(([code, q]) => ({ label: catalogByCode[code].label, quantity: q })), durationMin: duration, photos })
            techStatus(job.id, 'terminee')
            go({ name: 'signature', jobId, target: 'rapport' })
          }}
        >
          Valider et faire signer le client
        </Button>
      </div>
    </div>
  )
}

function Signature({ jobId, target, go }: { jobId: string; target: 'rapport' | 'devis'; go: (s: Screen) => void }) {
  const { jobs, requests, clients, quotes } = useLookups()
  const save = useStore((s) => s.saveReport)
  const signQuote = useStore((s) => s.signQuote)
  const job = jobs.get(jobId)!
  const r = requests.get(job.requestId)!
  const c = clients.get(r.clientId)!
  const q = r.quoteId ? quotes.get(r.quoteId) : undefined
  const [sig, setSig] = React.useState<string | null>(null)
  const [name, setName] = React.useState(`${c.firstName} ${c.lastName}`)
  return (
    <div>
      <Top title={target === 'devis' ? 'Signature du devis' : 'Signature du rapport'} back={() => go({ name: 'detail', jobId })} />
      <div className="space-y-3 p-4">
        <p className="text-sm">
          {target === 'devis' && q ? (
            <>
              Devis <b>{q.ref}</b> : <b>{money(totals(q.lines).ttc)} TTC</b>. Le client signe pour accord avant les travaux.
            </>
          ) : (
            <>Le client confirme la bonne réalisation de l’intervention.</>
          )}
        </p>
        <Field label="Nom du signataire" htmlFor="sig-name">
          <Input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <SignaturePad onChange={setSig} height={200} />
        <p className="text-[12px] text-muted">Horodatage, position et empreinte du document sont enregistrés avec la signature.</p>
      </div>
      <div className="sticky bottom-0 border-t border-border bg-surface p-3">
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          disabled={!sig}
          onClick={() => {
            if (target === 'devis' && q) {
              signQuote(q.id, name, sig!, true)
              go({ name: 'detail', jobId })
            } else {
              if (job.report) save(job.id, { ...job.report, photos: [], signature: sig!, signerName: name })
              go({ name: 'encaissement', jobId })
            }
          }}
        >
          Valider la signature
        </Button>
      </div>
    </div>
  )
}

function Payment({ jobId, go }: { jobId: string; go: (s: Screen) => void }) {
  const { jobs, requests, invoices } = useLookups()
  const createInvoice = useStore((s) => s.createInvoice)
  const recordPayment = useStore((s) => s.recordPayment)
  const job = jobs.get(jobId)!
  const r = requests.get(job.requestId)!
  const [qr, setQr] = React.useState(false)
  React.useEffect(() => {
    if (!r.invoiceId) createInvoice(r.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const inv = r.invoiceId ? invoices.get(r.invoiceId) : undefined
  if (!inv) return null
  const total = totals(inv.lines).ttc
  const paid = inv.status === 'payee'
  const pay = (m: PaymentMethod) => recordPayment(inv.id, m)
  return (
    <div>
      <Top title="Encaissement" back={() => go({ name: 'detail', jobId })} />
      <div className="space-y-4 p-4">
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
          <div className="text-[13px] text-muted">Facture {inv.ref}</div>
          <div className="font-display text-4xl font-extrabold tnum">{money(total)}</div>
          <div className="text-[13px] text-muted">TTC</div>
          {paid && (
            <Badge tone="ok" className="mt-2">
              <Check className="size-3.5" /> Payée
            </Badge>
          )}
        </div>
        {!paid && (
          <>
            {qr ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4">
                <QrCode text={`https://pay.urgencepro.example/${inv.ref}`} size={190} />
                <p className="text-center text-[13px] text-muted">Le client scanne et paie sur son téléphone (Stripe : carte, Apple Pay, Google Pay).</p>
                <Button variant="ok" onClick={() => pay('cb_en_ligne')}>
                  Simuler le paiement du client
                </Button>
              </div>
            ) : (
              <Button variant="primary" size="xl" className="w-full" onClick={() => setQr(true)}>
                <QrIcon /> QR code / lien de paiement
              </Button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['cb_terminal', 'CB terminal', CreditCard],
                  ['especes', 'Espèces', Banknote],
                  ['cheque', 'Chèque', FileSignature],
                ] as const
              ).map(([m, l, I]) => (
                <Button key={m} size="lg" className="h-16 flex-col gap-1 text-[13px]" onClick={() => pay(m)}>
                  <I /> {l}
                </Button>
              ))}
            </div>
          </>
        )}
        {paid && (
          <Button size="xl" className="w-full" onClick={() => go({ name: 'missions' })}>
            Retour à mes missions
          </Button>
        )}
      </div>
    </div>
  )
}
