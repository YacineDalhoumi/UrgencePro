import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Droplets, Flame, Zap, PanelTop, Waves, House, Check, ChevronLeft, ChevronRight, Phone, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge, Card, Field, Input, Select } from '@/components/ui/primitives'
import { SURCHARGES } from '@/data/reference'
import { cn } from '@/lib/utils'

const TRADES = [
  { key: 'serrurerie', label: 'Serrurerie', icon: KeyRound, items: 24 },
  { key: 'plomberie', label: 'Plomberie', icon: Droplets, items: 31 },
  { key: 'chauffage', label: 'Chauffage', icon: Flame, items: 18 },
  { key: 'electricite', label: 'Électricité', icon: Zap, items: 27 },
  { key: 'vitrerie', label: 'Vitrerie', icon: PanelTop, items: 15 },
  { key: 'debouchage', label: 'Débouchage', icon: Waves, items: 12 },
  { key: 'couverture', label: 'Couverture', icon: House, items: 20 },
]

const STEPS = ['Entreprise', 'Métiers', 'Zone', 'Tarifs', 'Téléphone', 'Équipe', 'C’est prêt']

export function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = React.useState(0)
  const [trades, setTrades] = React.useState<string[]>(['serrurerie'])
  const [radius, setRadius] = React.useState(12)
  const [number, setNumber] = React.useState('+33199004321')
  const [mode, setMode] = React.useState<'nouveau' | 'renvoi'>('nouveau')
  const [team, setTeam] = React.useState([{ name: 'Karim Benali', phone: '06 39 98 11 22' }])
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))
  const prev = () => setStep((s) => Math.max(0, s - 1))
  const minutesLeft = Math.max(1, Math.round((STEPS.length - 1 - step) * 1.3))

  return (
    <div className="min-h-[calc(100dvh-48px)] bg-bg px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="label-caps text-accent">Mise en route</div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{STEPS[step]}</h1>
          </div>
          <span className="text-sm text-muted">{step < STEPS.length - 1 ? `≈ ${minutesLeft} min restantes` : 'Terminé'}</span>
        </div>
        <ol className="mb-6 grid grid-cols-7 gap-1" aria-label="Étapes">
          {STEPS.map((s, i) => (
            <li key={s} className={cn('h-1.5 rounded-sm', i < step ? 'bg-ok' : i === step ? 'bg-accent' : 'bg-border')} title={s} />
          ))}
        </ol>

        <Card className="p-5 sm:p-6">
          {step === 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nom de l’entreprise" htmlFor="ob-name" className="sm:col-span-2">
                <Input id="ob-name" defaultValue="Serrurerie Saint-Clair" />
              </Field>
              <Field label="SIRET" htmlFor="ob-siret" hint="Nous récupérons raison sociale et adresse automatiquement.">
                <Input id="ob-siret" defaultValue="000 000 001 00011" className="tnum" />
              </Field>
              <Field label="Téléphone portable du gérant" htmlFor="ob-phone">
                <Input id="ob-phone" defaultValue="06 39 98 00 42" className="tnum" />
              </Field>
              <Field label="Assurance décennale / RC Pro" htmlFor="ob-ins" className="sm:col-span-2" hint="Obligatoire sur vos devis. Vous pourrez ajouter l’attestation plus tard.">
                <Input id="ob-ins" placeholder="Assureur et n° de contrat" />
              </Field>
            </div>
          )}
          {step === 1 && (
            <>
              <p className="mb-4 text-sm text-muted">Choisissez vos métiers : nous pré-remplissons le catalogue, les types de problèmes et des tarifs moyens que vous ajusterez.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TRADES.map((t) => {
                  const on = trades.includes(t.key)
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTrades(on ? trades.filter((x) => x !== t.key) : [...trades, t.key])}
                      className={cn('flex flex-col items-start gap-2 rounded-md border-2 p-3 text-left', on ? 'border-accent bg-accent-soft/50' : 'border-border hover:border-muted')}
                      aria-pressed={on}
                    >
                      <t.icon className={cn('size-6', on ? 'text-accent' : 'text-muted')} />
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-[12px] text-muted">{t.items} prestations types</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <Field label="Adresse du dépôt" htmlFor="ob-depot">
                <Input id="ob-depot" defaultValue="14 grande rue de Saint-Clair, 69300 Caluire-et-Cuire" />
              </Field>
              <Field label={`Rayon d’intervention : ${radius} km`} htmlFor="ob-radius" hint={`≈ ${Math.round(radius * 2.4)} codes postaux couverts. Vous pourrez dessiner la zone sur la carte.`}>
                <input id="ob-radius" type="range" min={3} max={40} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" />
              </Field>
              <div className="flex flex-wrap gap-1">
                {['69001', '69002', '69003', '69004', '69005', '69006', '69007', '69008', '69009', '69100', '69300', '69500', '69200', '69130'].slice(0, Math.min(14, Math.round(radius / 2.5) + 4)).map((cp, i) => (
                  <Badge key={cp} tone={i < 9 ? 'accent' : 'info'}>
                    {cp}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Taux horaire HT" htmlFor="ob-rate">
                  <Input id="ob-rate" defaultValue="65,00 €" />
                </Field>
                <Field label="Déplacement zone 1" htmlFor="ob-z1">
                  <Input id="ob-z1" defaultValue="35,00 € HT" />
                </Field>
                <Field label="Déplacement zone 2" htmlFor="ob-z2">
                  <Input id="ob-z2" defaultValue="49,00 € HT" />
                </Field>
              </div>
              <div className="rounded border border-border">
                {SURCHARGES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between border-b border-border px-3 py-2 last:border-0">
                    <span>
                      <b>{s.label}</b> <span className="text-muted">· {s.window}</span>
                    </span>
                    <span className="font-bold text-accent tnum">+{s.percent} %</span>
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-muted">Valeurs moyennes du marché pour votre métier. Elles sont toujours affichées au client avant l’intervention.</p>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    ['nouveau', 'Nouveau numéro', 'Un numéro local dédié au standard'],
                    ['renvoi', 'Garder mon numéro', 'Renvoi d’appel depuis votre ligne actuelle'],
                  ] as const
                ).map(([k, l, d]) => (
                  <button key={k} onClick={() => setMode(k)} className={cn('rounded-md border-2 p-3 text-left', mode === k ? 'border-accent bg-accent-soft/50' : 'border-border')}>
                    <div className="font-semibold">{l}</div>
                    <div className="text-[13px] text-muted">{d}</div>
                  </button>
                ))}
              </div>
              {mode === 'nouveau' ? (
                <Field label="Numéros disponibles" htmlFor="ob-number" hint="Les numéros français demandent un justificatif d’identité et d’adresse de l’entreprise (validation sous quelques jours). Le renvoi fonctionne immédiatement en attendant.">
                  <Select id="ob-number" value={number} onChange={(e) => setNumber(e.target.value)}>
                    {['+33199004321', '+33199004388', '+33199004402'].map((n) => (
                      <option key={n} value={n}>
                        {n.replace('+33', '0').replace(/(\d{2})(?=\d)/g, '$1 ')}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="rounded border border-border bg-sunken p-3 text-sm">
                  Composez <b className="font-mono">**21*01 99 00 43 21#</b> depuis votre ligne actuelle pour renvoyer les appels vers le standard UrgencePro.
                </div>
              )}
            </div>
          )}
          {step === 5 && (
            <div className="space-y-2">
              <p className="mb-2 text-sm text-muted">Chaque technicien reçoit un SMS pour installer l’application sur son téléphone.</p>
              {team.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <Input id={`ob-team-name-${i}`} aria-label="Nom" value={m.name} onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Input id={`ob-team-phone-${i}`} aria-label="Téléphone" value={m.phone} onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} className="w-44 tnum" />
                  <Button size="icon" variant="ghost" aria-label="Retirer" onClick={() => setTeam(team.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button size="sm" onClick={() => setTeam([...team, { name: '', phone: '' }])}>
                <Plus /> Ajouter un technicien
              </Button>
            </div>
          )}
          {step === 6 && (
            <div className="space-y-3 text-sm">
              {[
                `Catalogue pré-rempli : ${TRADES.filter((t) => trades.includes(t.key)).reduce((a, t) => a + t.items, 0)} prestations (${trades.length} métier${trades.length > 1 ? 's' : ''})`,
                `Zone d’intervention : ${radius} km autour du dépôt`,
                'Majorations nuit, week-end et urgence configurées',
                `Standard : ${mode === 'nouveau' ? number.replace('+33', '0').replace(/(\d{2})(?=\d)/g, '$1 ') : 'renvoi depuis votre numéro'}`,
                `${team.length} technicien${team.length > 1 ? 's' : ''} invité${team.length > 1 ? 's' : ''}`,
                '11 modèles de SMS prêts à l’emploi',
              ].map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-ok text-white">
                    <Check className="size-4" />
                  </span>
                  {l}
                </div>
              ))}
              <Button className="mt-2" onClick={() => toast.success('Appel de test en cours', { description: 'Votre téléphone va sonner via le standard.' })}>
                <Phone /> Tester mon standard
              </Button>
            </div>
          )}
        </Card>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" onClick={step ? prev : () => navigate('/tableau-de-bord')}>
            <ChevronLeft /> {step ? 'Retour' : 'Quitter'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" size="lg" onClick={next} disabled={step === 1 && trades.length === 0}>
              Continuer <ChevronRight />
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                toast.success('Bienvenue sur UrgencePro !')
                navigate('/tableau-de-bord')
              }}
            >
              Ouvrir mon tableau de bord
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
