import * as React from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Phone, Bot, Moon, Sun, CalendarOff, Webhook, CreditCard, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/store'
import { useLookups } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, Field, Input, Select, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui/primitives'
import { PageHeader, TechChip } from '@/components/shared/bits'
import { phone } from '@/lib/utils'

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Entreprise, téléphonie, SMS, automatisations, utilisateurs et abonnement." />
      <Tabs defaultValue="automatisations">
        <TabsList>
          <TabsTrigger value="entreprise">Entreprise</TabsTrigger>
          <TabsTrigger value="telephonie">Téléphonie</TabsTrigger>
          <TabsTrigger value="sms">Modèles SMS</TabsTrigger>
          <TabsTrigger value="automatisations">Automatisations</TabsTrigger>
          <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
          <TabsTrigger value="abonnement">Abonnement</TabsTrigger>
        </TabsList>
        <TabsContent value="entreprise" className="pt-4">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="telephonie" className="pt-4">
          <PhoneTab />
        </TabsContent>
        <TabsContent value="sms" className="pt-4">
          <SmsTab />
        </TabsContent>
        <TabsContent value="automatisations" className="pt-4">
          <AutomationsTab />
        </TabsContent>
        <TabsContent value="utilisateurs" className="pt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="abonnement" className="pt-4">
          <BillingTab />
        </TabsContent>
      </Tabs>
      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3 text-sm">
          <Webhook className="size-5 text-accent" />
          <span>
            Clés API, webhooks et documentation pour vos agents n8n : <b>Paramètres → API et webhooks</b>
          </span>
        </div>
        <Link to="/parametres/integrations" className="text-sm font-semibold text-accent hover:underline">
          Ouvrir
        </Link>
      </Card>
    </div>
  )
}

function CompanyTab() {
  const { ds } = useLookups()
  const c = ds.company
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('Informations enregistrées', { description: 'Elles apparaissent sur les prochains devis et factures.' })
  }
  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="p-4 lg:col-span-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom commercial" htmlFor="co-name">
            <Input id="co-name" defaultValue={c.name} />
          </Field>
          <Field label="Raison sociale" htmlFor="co-legal">
            <Input id="co-legal" defaultValue={c.legalName} />
          </Field>
          <Field label="SIRET" htmlFor="co-siret">
            <Input id="co-siret" defaultValue={c.siret} className="tnum" />
          </Field>
          <Field label="N° TVA intracommunautaire" htmlFor="co-vat">
            <Input id="co-vat" defaultValue={c.vatNumber} />
          </Field>
          <Field label="Adresse du siège" htmlFor="co-address" className="sm:col-span-2">
            <Input id="co-address" defaultValue={c.address} />
          </Field>
          <Field label="Assurance décennale / RC Pro" htmlFor="co-insurance" className="sm:col-span-2" hint="Mention obligatoire sur les devis et factures.">
            <Input id="co-insurance" defaultValue={c.insurance} />
          </Field>
          <Field label="Taux horaire HT" htmlFor="co-rate">
            <Input id="co-rate" defaultValue={(c.hourlyRateCents / 100).toFixed(2).replace('.', ',') + ' €'} />
          </Field>
          <Field label="Conditions de paiement" htmlFor="co-terms">
            <Select id="co-terms" defaultValue="reception">
              <option value="reception">À réception</option>
              <option value="15">15 jours</option>
              <option value="30">30 jours (professionnels)</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="primary">
            Enregistrer
          </Button>
        </div>
      </Card>
      <Card className="p-4">
        <div className="label-caps text-muted">Identité visuelle</div>
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-flex size-14 items-center justify-center rounded font-display text-2xl font-extrabold text-white" style={{ background: c.brandColor }}>
            {c.shortName[0]}
          </span>
          <div className="text-sm">
            <div className="font-semibold">Logo</div>
            <div className="text-muted">PNG ou SVG, fond transparent</div>
          </div>
        </div>
        <Field label="Couleur principale" htmlFor="co-color" className="mt-4">
          <div className="flex items-center gap-2">
            <input id="co-color" type="color" defaultValue={c.brandColor} className="h-10 w-14 rounded border border-border bg-surface" />
            <span className="font-mono text-sm">{c.brandColor}</span>
          </div>
        </Field>
        <p className="mt-3 text-[13px] text-muted">Utilisée sur les devis, factures, pages client et SMS de suivi.</p>
      </Card>
    </form>
  )
}

function PhoneTab() {
  const { ds } = useLookups()
  const onCall = ds.technicians.find((t) => t.onCall)
  const [ivr, setIvr] = React.useState(false)
  const [rec, setRec] = React.useState(true)
  const rules = [
    { icon: Sun, name: 'Heures ouvrées', when: 'Lun–ven 8 h–19 h, sam 9 h–12 h', strategy: 'Sonnerie simultanée', targets: `Secrétariat, ${onCall?.firstName}`, fallback: 'Agent vocal IA après 25 s' },
    { icon: Moon, name: 'Nuit et week-end', when: 'Hors heures ouvrées', strategy: 'En cascade', targets: `${onCall?.firstName} (astreinte) puis ${ds.technicians[1]?.firstName}`, fallback: 'Agent vocal IA, puis SMS avec lien' },
    { icon: CalendarOff, name: 'Jours fériés', when: 'Calendrier officiel', strategy: 'En cascade', targets: 'Technicien d’astreinte', fallback: 'Messagerie avec transcription' },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="p-4">
        <div className="label-caps text-muted">Numéro du standard</div>
        <div className="mt-1 flex items-center gap-2 font-display text-2xl font-extrabold tnum">
          <Phone className="size-5 text-accent" /> {phone(ds.company.phone)}
        </div>
        <p className="mt-1 text-[13px] text-muted">Numéro virtuel Twilio. Dossier réglementaire validé. Renvoi possible depuis votre numéro actuel.</p>
        <Field label="Message d’accueil" htmlFor="greeting" className="mt-4">
          <Textarea id="greeting" defaultValue={`${ds.company.name}, bonjour. Cet appel peut être enregistré pour la qualité du service.`} />
        </Field>
        <div className="mt-3 space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Enregistrement des appels (avec annonce)</span>
            <Switch id="rec" checked={rec} onCheckedChange={setRec} label="Enregistrement" />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Menu vocal (1 : urgence, 2 : rendez-vous)</span>
            <Switch id="ivr" checked={ivr} onCheckedChange={setIvr} label="Menu vocal" />
          </label>
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Règles de routage" subtitle="Évaluées dans l’ordre à chaque appel entrant" />
        <div className="space-y-2 px-4 pb-4">
          {rules.map((r, i) => (
            <div key={r.name} className="flex flex-wrap items-start gap-3 rounded border border-border p-3 text-sm">
              <span className="inline-flex size-8 items-center justify-center rounded bg-sunken font-bold tnum">{i + 1}</span>
              <r.icon className="mt-1.5 size-4 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{r.name}</div>
                <div className="text-[13px] text-muted">{r.when}</div>
              </div>
              <div className="min-w-0 text-[13px] sm:w-64">
                <div>
                  <b>{r.strategy}</b> : {r.targets}
                </div>
                <div className="flex items-center gap-1 text-muted">
                  <Bot className="size-3.5 text-ai" /> {r.fallback}
                </div>
              </div>
            </div>
          ))}
          <Field label="URL de l’agent vocal IA (n8n)" htmlFor="ai-url" hint="Appelée par Twilio quand personne ne décroche.">
            <Input id="ai-url" defaultValue="https://n8n.example.com/webhook/agent-vocal" className="font-mono text-[13px]" />
          </Field>
        </div>
      </Card>
    </div>
  )
}

function SmsTab() {
  const { ds } = useLookups()
  const toggle = useStore((s) => s.toggleTemplate)
  const update = useStore((s) => s.updateTemplate)
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Variables disponibles : {['{prenom_client}', '{entreprise}', '{technicien}', '{eta}', '{lien_suivi}', '{lien}', '{montant}'].map((v) => (
          <code key={v} className="mr-1 rounded bg-sunken px-1 font-mono text-[12px]">
            {v}
          </code>
        ))}
        · STOP géré automatiquement.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {ds.templates.map((t) => (
          <Card key={t.key} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-[12px] text-muted">Déclencheur : {t.trigger}</div>
              </div>
              <Switch id={`tpl-${t.key}`} checked={t.active} onCheckedChange={() => toggle(t.key)} label={t.name} />
            </div>
            <Textarea id={`tpl-body-${t.key}`} className="mt-2 font-mono text-[12px]" defaultValue={t.body} onBlur={(e) => e.target.value !== t.body && (update(t.key, e.target.value), toast.success('Modèle enregistré'))} />
            <div className="mt-1 text-right text-[11px] text-muted tnum">{t.body.length} caractères · {Math.ceil(t.body.length / 160)} SMS</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AutomationsTab() {
  const { ds } = useLookups()
  const toggle = useStore((s) => s.toggleAutomation)
  return (
    <Card>
      <CardHeader title="Automatisations" subtitle="Chaque automatisation peut être coupée. Celles qui reposent sur un agent IA sont marquées." />
      <ul className="divide-y divide-border">
        {ds.automations.map((a) => (
          <li key={a.key} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                {a.label}
                {a.ai && (
                  <Badge tone="ai">
                    <Sparkles className="size-3.5" /> IA
                  </Badge>
                )}
                {a.detail && <Badge>{a.detail}</Badge>}
              </div>
              <p className="text-[13px] text-muted">{a.description}</p>
            </div>
            <Switch
              id={`auto-${a.key}`}
              checked={a.enabled}
              label={a.label}
              onCheckedChange={() => {
                toggle(a.key)
                toast(`${a.label} : ${a.enabled ? 'désactivée' : 'activée'}`)
              }}
            />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function UsersTab() {
  const { ds } = useLookups()
  const users = [
    { name: 'Christophe (gérant)', email: 'gerant@example.com', role: 'Administrateur' },
    { name: 'Sandrine', email: 'secretariat@example.com', role: 'Dispatcher' },
  ]
  return (
    <Card>
      <CardHeader title="Utilisateurs" action={<Button size="sm" onClick={() => toast.success('Invitation envoyée par e-mail')}><Plus /> Inviter</Button>} />
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-sunken text-left text-[12px] text-muted">
            <tr>
              <th className="px-4 py-2 font-semibold">Nom</th>
              <th className="px-3 py-2 font-semibold">Rôle</th>
              <th className="px-3 py-2 font-semibold">Accès</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.name} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-[12px] text-muted">{u.email}</div>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={u.role === 'Administrateur' ? 'accent' : 'info'}>{u.role}</Badge>
                </td>
                <td className="px-3 py-2.5 text-[13px] text-muted">{u.role === 'Administrateur' ? 'Accès complet, paramètres, statistiques' : 'Demandes, planning, devis, factures'}</td>
              </tr>
            ))}
            {ds.technicians.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <TechChip tech={t} />
                </td>
                <td className="px-3 py-2.5">
                  <Badge>Technicien</Badge>
                </td>
                <td className="px-3 py-2.5 text-[13px] text-muted">Application mobile, ses interventions uniquement</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function BillingTab() {
  const { ds } = useLookups()
  const plans = [
    { name: 'Solo', price: '49 €', desc: '1 technicien, standard 24/7, devis et factures' },
    { name: 'Équipe', price: '129 €', desc: 'Jusqu’à 8 techniciens, planning, carte en direct, API', current: true },
    { name: 'Entreprise', price: '290 €', desc: 'Jusqu’à 30 techniciens, multi-dépôts, support prioritaire' },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {plans.map((p) => (
        <Card key={p.name} className={p.current ? 'border-accent p-4' : 'p-4'}>
          <div className="flex items-center justify-between">
            <div className="font-display text-lg font-bold">{p.name}</div>
            {p.current && <Badge tone="accent">Formule actuelle</Badge>}
          </div>
          <div className="mt-1 font-display text-3xl font-extrabold">
            {p.price}
            <span className="text-sm font-normal text-muted"> HT / mois</span>
          </div>
          <p className="mt-2 text-sm text-muted">{p.desc}</p>
          <p className="mt-2 text-[12px] text-muted">SMS et minutes d’appel facturés à l’usage.</p>
        </Card>
      ))}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 lg:col-span-3">
        <div className="flex items-center gap-3 text-sm">
          <CreditCard className="size-5 text-muted" />
          <span>
            <b>Encaissements clients</b> : compte Stripe de {ds.company.name} connecté. Les paiements arrivent directement sur votre compte.
          </span>
        </div>
        <Badge tone="ok">Stripe connecté</Badge>
      </Card>
    </div>
  )
}
