// Pages publiques du client final (sans compte) : accès par lien signé à usage limité.
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Camera, LocateFixed, Lock, Check, Phone, ShieldCheck, Star, Truck, CreditCard, ChevronRight, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/store'
import { useLookups, addressOf } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Badge, Card, Field, Input, Textarea } from '@/components/ui/primitives'
import { PageHeader, PhoneFrame, PriceBreakdown, PriceRange, SignaturePad, Stars } from '@/components/shared/bits'
import { CityMap } from '@/components/shared/CityMap'
import { DocumentView } from '@/components/shared/DocumentView'
import { problemByCode, REQUEST_STATUS } from '@/data/reference'
import { totals } from '@/data/pricing'
import type { ServiceRequest } from '@/data/types'
import { cn, initials, money, phone, timeFr, MINUTE } from '@/lib/utils'

type Page = 'photos' | 'suivi' | 'devis' | 'paiement' | 'avis'

const PAGES: { key: Page; label: string; desc: string; match: (r: ServiceRequest) => boolean }[] = [
  { key: 'photos', label: 'Envoi de photos et localisation', desc: 'Lien reçu par SMS après l’appel', match: (r) => r.status === 'nouvelle' || r.status === 'qualifiee' },
  { key: 'suivi', label: 'Suivi du technicien en direct', desc: 'Lien du SMS « votre technicien est en route »', match: (r) => ['en_route', 'planifiee', 'sur_place'].includes(r.status) },
  { key: 'devis', label: 'Consultation et signature du devis', desc: 'Lien du SMS d’envoi du devis', match: (r) => r.status === 'devis_envoye' },
  { key: 'paiement', label: 'Paiement de la facture', desc: 'Lien du SMS ou QR code du technicien', match: (r) => r.status === 'facturee' },
  { key: 'avis', label: 'Avis après intervention', desc: 'Lien envoyé 2 h après la fin', match: (r) => ['payee', 'terminee'].includes(r.status) && !r.reviewId },
]

export function ClientHub() {
  const { ds, clients } = useLookups()
  const recent = ds.requests.filter((r) => r.createdAt > Date.now() - 2 * 86400000)
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <PageHeader title="Parcours client" subtitle="Le client n’a pas de compte : il reçoit des liens sécurisés par SMS, valables 48 h par défaut. Choisissez une demande pour jouer son rôle." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PAGES.map((p) => {
          const reqs = recent.filter(p.match).slice(0, 3)
          return (
            <Card key={p.key} className="p-4">
              <div className="font-display text-[15px] font-bold">{p.label}</div>
              <div className="text-[13px] text-muted">{p.desc}</div>
              <div className="mt-3 space-y-1.5">
                {reqs.length === 0 && <p className="text-[13px] text-muted">Aucune demande à cette étape pour l’instant.</p>}
                {reqs.map((r) => {
                  const c = clients.get(r.clientId)
                  return (
                    <Link key={r.id} to={`/client/${r.id}/${p.key}`} className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm hover:border-accent">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {c?.firstName} {c?.lastName} · {problemByCode[r.problemTypeCode]?.label}
                        </span>
                        <span className="text-[12px] text-muted">
                          {r.ref} · {REQUEST_STATUS[r.status].label}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    </Link>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export function ClientPortal() {
  const { requestId, page } = useParams()
  const { ds } = useLookups()
  const navigate = useNavigate()
  const req = ds.requests.find((r) => r.id === requestId)
  if (!req) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-semibold">Ce lien a expiré ou n’est plus valide.</p>
        <Link to="/client" className="text-accent underline">
          Retour au parcours client
        </Link>
      </div>
    )
  }
  const c = ds.company
  return (
    <div className="px-4 py-4 sm:py-8">
      <div className="mx-auto mb-4 flex max-w-[400px] items-center justify-between">
        <button onClick={() => navigate('/client')} className="text-[13px] font-semibold text-muted hover:text-fg">
          ← Parcours client
        </button>
        <span className="flex items-center gap-1 text-[12px] text-muted">
          <Lock className="size-3.5" /> urgencepro.example/c/7Hk2…
        </span>
      </div>
      <PhoneFrame>
        <div className="flex items-center gap-2.5 px-4 py-3 text-white" style={{ background: c.brandColor }}>
          <span className="inline-flex size-8 items-center justify-center rounded bg-white/20 font-display font-extrabold">{c.shortName[0]}</span>
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-bold">{c.name}</div>
            <div className="text-[11px] opacity-85">Demande {req.ref}</div>
          </div>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {page === 'photos' && <PhotosPage req={req} />}
          {page === 'suivi' && <TrackingPage req={req} />}
          {page === 'devis' && <QuotePage req={req} />}
          {page === 'paiement' && <PaymentPage req={req} />}
          {page === 'avis' && <ReviewPage req={req} />}
        </div>
        <div className="border-t border-border px-4 py-2 text-center text-[10px] text-muted">
          {c.legalName} · SIRET {c.siret} · <span className="underline">Données personnelles</span>
        </div>
      </PhoneFrame>
    </div>
  )
}

// ——— Photos et localisation ———

function PhotosPage({ req }: { req: ServiceRequest }) {
  const { ds } = useLookups()
  const upload = useStore((s) => s.clientUpload)
  const locate = useStore((s) => s.clientLocation)
  const addr = addressOf(ds, req.clientId, req.addressId)!
  const [files, setFiles] = React.useState<{ src: string; caption: string }[]>([])
  const [loc, setLoc] = React.useState<'idle' | 'pending' | 'ok'>('idle')
  const [line1, setLine1] = React.useState(addr.line1 === 'Adresse à confirmer' ? '' : addr.line1)
  const [floor, setFloor] = React.useState(addr.floor ?? '')
  const [code, setCode] = React.useState(addr.doorCode ?? '')
  const [intercom, setIntercom] = React.useState(addr.intercom ?? '')
  const [comment, setComment] = React.useState('')
  const [consent, setConsent] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const pick = (list: FileList | null) => {
    if (!list) return
    const add = Array.from(list).slice(0, 10 - files.length).map((f, i) => ({ src: URL.createObjectURL(f), caption: `Photo ${files.length + i + 1}` }))
    setFiles((x) => [...x, ...add])
  }
  const samples = () => {
    // Photos d'exemple générées (la démo n'embarque pas de vraies photos)
    const mk = (hue: number, label: string) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},25%,45%)"/><stop offset="1" stop-color="hsl(${hue},25%,25%)"/></linearGradient></defs><rect width="200" height="180" fill="url(#g)"/><rect x="60" y="22" width="80" height="136" rx="3" fill="hsl(${hue},20%,60%)" stroke="#222" stroke-width="3"/><circle cx="126" cy="96" r="6" fill="#d9c27a"/><text x="100" y="172" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#fff">${label}</text></svg>`
      return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, caption: label }
    }
    setFiles([mk(25, 'Porte d’entrée'), mk(210, 'Serrure'), mk(140, 'Vue d’ensemble')])
  }
  const shareGps = () => {
    setLoc('pending')
    // Dans l'application : navigator.geolocation. Ici, position simulée.
    setTimeout(() => setLoc('ok'), 900)
  }

  if (done)
    return (
      <div className="space-y-4 p-5">
        <div className="flex flex-col items-center gap-2 pt-4 text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-ok text-white">
            <Check className="size-8" />
          </span>
          <h2 className="font-display text-xl font-bold">Merci, c’est bien reçu</h2>
          <p className="text-sm text-muted">Nous vous rappelons dans quelques minutes avec l’heure d’arrivée du technicien.</p>
        </div>
        <Card className="p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ok">
            <ShieldCheck className="size-4" /> Prix annoncé avant intervention
          </div>
          <PriceBreakdown est={req.estimate} />
        </Card>
      </div>
    )

  return (
    <form
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!consent) {
          toast.error('Merci d’accepter l’utilisation de vos données pour traiter la demande.')
          return
        }
        if (files.length) upload(req.id, files)
        locate(req.id, loc === 'ok' ? 'gps' : 'adresse', { line1: line1 || undefined, floor, doorCode: code, intercom, comment })
        setDone(true)
      }}
    >
      <div>
        <h2 className="font-display text-lg font-bold">Décrivez-nous la situation</h2>
        <p className="text-[13px] text-muted">Quelques photos nous permettent d’annoncer un prix précis et de venir avec les bonnes pièces.</p>
      </div>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">1. Photos ou vidéo</span>
          <span className="text-[12px] text-muted tnum">{files.length}/10</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div key={i} className="aspect-square overflow-hidden rounded border border-border">
              <img src={f.src} alt={f.caption} className="h-full w-full object-cover" />
            </div>
          ))}
          {files.length < 10 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-border text-[12px] font-semibold text-muted hover:border-accent">
              <Camera className="size-6" />
              Prendre une photo
              <input type="file" accept="image/*,video/*" capture="environment" multiple className="sr-only" onChange={(e) => pick(e.target.files)} />
            </label>
          )}
        </div>
        {files.length === 0 && (
          <button type="button" onClick={samples} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
            <ImagePlus className="size-4" /> Utiliser des photos d’exemple (démo)
          </button>
        )}
        <p className="mt-1 text-[11px] text-muted">Les photos sont compressées automatiquement avant l’envoi.</p>
      </section>
      <section className="space-y-2">
        <span className="text-sm font-semibold">2. Où êtes-vous ?</span>
        <Button type="button" size="lg" variant={loc === 'ok' ? 'ok' : 'primary'} className="w-full" onClick={shareGps} disabled={loc === 'pending'}>
          <LocateFixed /> {loc === 'ok' ? 'Position partagée (précision 12 m)' : loc === 'pending' ? 'Localisation…' : 'Partager ma position'}
        </Button>
        {loc === 'ok' && (
          <div className="aspect-[1000/680] overflow-hidden rounded border border-border">
            <CityMap city={ds.company.city} center={addr.location} zoom={2.4} markers={[{ id: 'me', at: addr.location, kind: 'job', pulse: true }]} />
          </div>
        )}
        <Field label="ou saisissez l’adresse" htmlFor="c-line1">
          <Input id="c-line1" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="12 rue Victor Hugo" autoComplete="street-address" />
        </Field>
      </section>
      <section className="space-y-2">
        <span className="text-sm font-semibold">3. Accès</span>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Étage" htmlFor="c-floor">
            <Input id="c-floor" value={floor} onChange={(e) => setFloor(e.target.value)} />
          </Field>
          <Field label="Code" htmlFor="c-code">
            <Input id="c-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Interphone" htmlFor="c-intercom">
            <Input id="c-intercom" value={intercom} onChange={(e) => setIntercom(e.target.value)} />
          </Field>
        </div>
        <Field label="Commentaire" htmlFor="c-comment">
          <Textarea id="c-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ex. : je patiente chez la voisine du 2e" />
        </Field>
      </section>
      <label className="flex items-start gap-2 text-[12px] text-muted">
        <input type="checkbox" id="c-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[rgb(var(--accent))]" />
        J’accepte que {ds.company.name} utilise ces informations pour traiter ma demande. Données conservées 3 ans, supprimables sur simple demande.
      </label>
      <Button type="submit" variant="primary" size="xl" className="w-full">
        Envoyer
      </Button>
    </form>
  )
}

// ——— Suivi en temps réel ———

function TrackingPage({ req }: { req: ServiceRequest }) {
  const { ds, jobs, techs } = useLookups()
  const job = req.jobId ? jobs.get(req.jobId) : undefined
  const tech = job?.technicianId ? techs.get(job.technicianId) : undefined
  const addr = addressOf(ds, req.clientId, req.addressId)!
  const steps = [
    { k: 'planifiee', l: 'Prise en charge' },
    { k: 'en_route', l: 'En route' },
    { k: 'sur_place', l: 'Sur place' },
    { k: 'terminee', l: 'Terminé' },
  ]
  const idx = Math.max(0, steps.findIndex((s) => s.k === req.status))
  const doneIdx = ['terminee', 'facturee', 'payee', 'cloturee'].includes(req.status) ? 3 : idx
  return (
    <div>
      <div className="aspect-[1000/760] w-full">
        <CityMap
          city={ds.company.city}
          center={tech && job?.status === 'en_route' ? { lat: (tech.position.lat + addr.location.lat) / 2, lng: (tech.position.lng + addr.location.lng) / 2 } : addr.location}
          zoom={2}
          rounded={false}
          route={tech && job?.status === 'en_route' ? [tech.position, addr.location] : undefined}
          markers={[{ id: 'dest', at: addr.location, kind: 'home' }, ...(tech ? [{ id: tech.id, at: tech.position, kind: 'tech' as const, color: tech.color, label: initials(tech.firstName, tech.lastName), pulse: job?.status === 'en_route' }] : [])]}
        />
      </div>
      <div className="space-y-4 p-4">
        <div className="text-center">
          {job?.status === 'en_route' ? (
            <>
              <div className="text-[13px] text-muted">Arrivée estimée</div>
              <div className="font-display text-4xl font-extrabold tnum">{timeFr(Date.now() + (job.etaMin ?? 10) * MINUTE)}</div>
              <div className="text-sm font-semibold text-accent">dans {job.etaMin} min · trafic en temps réel</div>
            </>
          ) : job?.status === 'sur_place' ? (
            <div className="font-display text-2xl font-extrabold">Votre technicien est sur place</div>
          ) : (
            <>
              <div className="text-[13px] text-muted">Passage prévu</div>
              <div className="font-display text-3xl font-extrabold tnum">{job ? timeFr(job.start) : '—'}</div>
            </>
          )}
        </div>
        <ol className="grid grid-cols-4 gap-1">
          {steps.map((s, i) => (
            <li key={s.k} className="text-center">
              <div className={cn('h-1.5 rounded-sm', i <= doneIdx ? 'bg-accent' : 'bg-border')} />
              <div className={cn('mt-1 text-[11px] font-semibold', i === doneIdx ? 'text-fg' : 'text-muted')}>{s.l}</div>
            </li>
          ))}
        </ol>
        {tech && (
          <Card className="flex items-center gap-3 p-3">
            <span className="inline-flex size-12 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: tech.color }}>
              {initials(tech.firstName, tech.lastName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{tech.firstName}, votre technicien</div>
              <div className="flex items-center gap-1 text-[13px] text-muted">
                <Truck className="size-3.5" /> {tech.vehicle.split(' — ')[0]} · <Stars value={4.8} size={11} />
              </div>
            </div>
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-ok text-white" title={phone(ds.company.phone)}>
              <Phone className="size-5" />
            </span>
          </Card>
        )}
        <Card className="p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ok">
            <ShieldCheck className="size-4" /> Prix annoncé
          </div>
          <div className="flex items-baseline justify-between">
            <span>{problemByCode[req.problemTypeCode]?.label}</span>
            <b className="tnum">
              <PriceRange est={req.estimate} /> TTC
            </b>
          </div>
          <p className="mt-1 text-[12px] text-muted">Aucun travail supplémentaire sans votre accord écrit.</p>
        </Card>
        <p className="text-center text-[12px] text-muted">Une question ? Appelez le {phone(ds.company.phone)}</p>
      </div>
    </div>
  )
}

// ——— Devis ———

function QuotePage({ req }: { req: ServiceRequest }) {
  const { ds, quotes, clients } = useLookups()
  const view = useStore((s) => s.viewQuote)
  const sign = useStore((s) => s.signQuote)
  const q = req.quoteId ? quotes.get(req.quoteId) : undefined
  const client = clients.get(req.clientId)!
  const [accept, setAccept] = React.useState(false)
  const [waiver, setWaiver] = React.useState(q?.urgentWaiver ?? false)
  const [vat, setVat] = React.useState(false)
  const [sig, setSig] = React.useState<string | null>(null)
  const [name, setName] = React.useState(`${client.firstName} ${client.lastName}`)
  React.useEffect(() => {
    if (q) view(q.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id])
  if (!q) return <p className="p-4 text-sm text-muted">Aucun devis pour cette demande.</p>
  const t = totals(q.lines)
  const reduced = t.vatByRate.some(([r]) => r < 20)
  if (q.status === 'signe')
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-ok text-white">
          <Check className="size-8" />
        </span>
        <h2 className="font-display text-xl font-bold">Devis signé</h2>
        <p className="text-sm text-muted">Signé par {q.signerName} à {timeFr(q.signedAt!)}. Vous recevez une copie par SMS et e-mail. Nous planifions l’intervention.</p>
      </div>
    )
  return (
    <div className="space-y-4 p-3">
      <div className="origin-top">
        <DocumentView kind="devis" refNo={q.ref} company={ds.company} client={client} address={addressOf(ds, req.clientId, req.addressId)} lines={q.lines} issuedAt={q.sentAt ?? q.createdAt} validUntil={q.validUntil} depositPercent={q.depositPercent} urgentWaiver={q.urgentWaiver} compact />
      </div>
      <div className="space-y-2 px-1 text-[13px]">
        <label className="flex items-start gap-2">
          <input type="checkbox" id="q-accept" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 size-4 accent-[rgb(var(--accent))]" />
          J’accepte ce devis d’un montant de <b className="tnum">{money(t.ttc)} TTC</b> (lu et approuvé).
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" id="q-waiver" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} className="mt-0.5 size-4 accent-[rgb(var(--accent))]" />
          Je demande une intervention immédiate pour un dépannage urgent (renonciation au délai de rétractation pour ces travaux).
        </label>
        {reduced && (
          <label className="flex items-start gap-2">
            <input type="checkbox" id="q-vat" checked={vat} onChange={(e) => setVat(e.target.checked)} className="mt-0.5 size-4 accent-[rgb(var(--accent))]" />
            Je certifie que le logement est achevé depuis plus de 2 ans (TVA à taux réduit).
          </label>
        )}
      </div>
      <Field label="Nom" htmlFor="q-name">
        <Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <SignaturePad onChange={setSig} height={150} />
      <Button variant="primary" size="xl" className="w-full" disabled={!accept || !sig || (reduced && !vat)} onClick={() => sign(q.id, name, sig!, waiver)}>
        Signer le devis
      </Button>
      {q.depositPercent > 0 && <p className="text-center text-[12px] text-muted">Un acompte de {money(Math.round((t.ttc * q.depositPercent) / 100))} vous sera demandé (paiement sécurisé Stripe).</p>}
    </div>
  )
}

// ——— Paiement ———

function PaymentPage({ req }: { req: ServiceRequest }) {
  const { invoices, ds } = useLookups()
  const pay = useStore((s) => s.recordPayment)
  const inv = req.invoiceId ? invoices.get(req.invoiceId) : undefined
  const [processing, setProcessing] = React.useState(false)
  if (!inv) return <p className="p-4 text-sm text-muted">Aucune facture à régler.</p>
  const t = totals(inv.lines)
  if (inv.status === 'payee')
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-ok text-white">
          <Check className="size-8" />
        </span>
        <h2 className="font-display text-xl font-bold">Paiement reçu, merci !</h2>
        <p className="text-sm text-muted">Votre facture acquittée vous est envoyée par e-mail.</p>
      </div>
    )
  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setProcessing(true)
        setTimeout(() => {
          pay(inv.id, 'cb_en_ligne')
          setProcessing(false)
        }, 1200)
      }}
    >
      <Card className="p-4 text-center">
        <div className="text-[13px] text-muted">Facture {inv.ref}</div>
        <div className="font-display text-4xl font-extrabold tnum">{money(t.ttc)}</div>
        <div className="text-[12px] text-muted">dont TVA {money(t.vat)}</div>
      </Card>
      <div className="space-y-1 text-[13px]">
        {inv.lines.map((l) => (
          <div key={l.id} className="flex justify-between gap-3">
            <span className="truncate text-muted">{l.label}</span>
            <span className="tnum">{money(Math.round(l.unitPriceCents * l.quantity * (1 + l.vatRate / 100)))}</span>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <CreditCard className="size-4" /> Carte bancaire
          </span>
          <Badge tone="warn">Mode test</Badge>
        </div>
        <Input id="card-number" defaultValue="4242 4242 4242 4242" className="font-mono tnum" aria-label="Numéro de carte" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Input id="card-exp" defaultValue="12 / 28" className="font-mono" aria-label="Expiration" />
          <Input id="card-cvc" defaultValue="123" className="font-mono" aria-label="Cryptogramme" />
        </div>
      </div>
      <Button type="submit" variant="primary" size="xl" className="w-full" disabled={processing}>
        <Lock /> {processing ? 'Paiement en cours…' : `Payer ${money(t.ttc)}`}
      </Button>
      <p className="text-center text-[11px] text-muted">Paiement sécurisé par Stripe, versé directement à {ds.company.name}.</p>
    </form>
  )
}

// ——— Avis ———

function ReviewPage({ req }: { req: ServiceRequest }) {
  const { ds } = useLookups()
  const submit = useStore((s) => s.submitReview)
  const [rating, setRating] = React.useState(0)
  const [comment, setComment] = React.useState('')
  const [sent, setSent] = React.useState(false)
  if (sent || req.reviewId)
    return (
      <div className="space-y-4 p-6 text-center">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-ok text-white">
          <Check className="size-8" />
        </span>
        <h2 className="font-display text-xl font-bold">Merci pour votre retour</h2>
        <p className="text-sm text-muted">Vous pouvez aussi partager votre avis publiquement sur notre fiche Google. Cela aide d’autres personnes à trouver un artisan de confiance.</p>
        <Button size="lg" className="w-full" onClick={() => toast('Ouverture de la fiche Google de l’entreprise', { description: 'Lien direct vers le formulaire d’avis Google.' })}>
          <Star /> Laisser un avis sur Google
        </Button>
      </div>
    )
  return (
    <div className="space-y-5 p-5">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold">Comment s’est passée l’intervention ?</h2>
        <p className="text-sm text-muted">{problemByCode[req.problemTypeCode]?.label} · {ds.company.name}</p>
      </div>
      <div className="flex justify-center gap-2" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} role="radio" aria-checked={rating === i} aria-label={`${i} sur 5`} onClick={() => setRating(i)} className="p-1">
            <svg width="40" height="40" viewBox="0 0 20 20" aria-hidden>
              <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" fill={i <= rating ? 'rgb(var(--warn))' : 'rgb(var(--border))'} />
            </svg>
          </button>
        ))}
      </div>
      <Field label="Un commentaire ? (facultatif)" htmlFor="rv-comment">
        <Textarea id="rv-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <Button
        variant="primary"
        size="xl"
        className="w-full"
        disabled={!rating}
        onClick={() => {
          submit(req.id, rating, comment || (rating >= 4 ? 'Très satisfait.' : 'Peut mieux faire.'))
          setSent(true)
        }}
      >
        Envoyer mon avis
      </Button>
      <p className="text-center text-[12px] text-muted">Après l’envoi, vous pourrez aussi publier votre avis sur Google, quelle que soit votre note.</p>
    </div>
  )
}
