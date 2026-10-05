import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2, Send, ExternalLink, PenLine, Receipt, Info } from 'lucide-react'
import { useStore } from '@/store/store'
import { useLookups, addressOf } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Dialog, Empty, Field, Input, Select } from '@/components/ui/primitives'
import { AiBadge, PageHeader, QuoteBadge, SignaturePad } from '@/components/shared/bits'
import { DocumentView } from '@/components/shared/DocumentView'
import { catalogForTrades, totals } from '@/data/pricing'
import type { DocLine } from '@/data/types'
import { dateTimeFr, money, uid } from '@/lib/utils'

export function QuoteEditorPage() {
  const { id } = useParams()
  const { ds, clients } = useLookups()
  const q = ds.quotes.find((x) => x.id === id)
  const updateQuote = useStore((s) => s.updateQuote)
  const sendQuote = useStore((s) => s.sendQuote)
  const signQuote = useStore((s) => s.signQuote)
  const createInvoice = useStore((s) => s.createInvoice)
  const navigate = useNavigate()
  const [signOpen, setSignOpen] = React.useState(false)
  const [sig, setSig] = React.useState<string | null>(null)
  const [signer, setSigner] = React.useState('')
  const [addCode, setAddCode] = React.useState('')
  if (!q) return <Empty title="Devis introuvable" action={<Link to="/devis" className="text-accent underline">Retour aux devis</Link>} />
  const req = ds.requests.find((r) => r.id === q.requestId)!
  const client = clients.get(q.clientId)!
  const address = addressOf(ds, req.clientId, req.addressId)
  const editable = q.status === 'brouillon' || q.status === 'envoye' || q.status === 'consulte'
  const t = totals(q.lines)
  const catalog = catalogForTrades(ds.company.trades)
  const setLines = (lines: DocLine[]) => updateQuote(q.id, { lines })
  const patchLine = (lid: string, patch: Partial<DocLine>) => setLines(q.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)))
  const job = req.jobId ? ds.jobs.find((j) => j.id === req.jobId) : undefined

  return (
    <div>
      <Link to={`/demandes/${req.id}`} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-fg">
        <ChevronLeft className="size-4" /> Demande {req.ref}
      </Link>
      <PageHeader
        title={`Devis ${q.ref}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <QuoteBadge s={q.status} />
            {q.aiDraft && <AiBadge label="Brouillon préparé par l’IA" />}
            {client.companyName ?? `${client.firstName} ${client.lastName}`}
            {q.sentAt && ` · envoyé ${dateTimeFr(q.sentAt)}`}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(`/client/${req.id}/devis`)}>
              <ExternalLink /> Vue client
            </Button>
            {editable && (
              <Button onClick={() => setSignOpen(true)}>
                <PenLine /> Faire signer sur place
              </Button>
            )}
            {q.status === 'brouillon' && (
              <Button variant="primary" onClick={() => sendQuote(q.id)}>
                <Send /> Envoyer par SMS et e-mail
              </Button>
            )}
            {q.status === 'signe' && (
              <Button
                variant="primary"
                disabled={!job || job.status !== 'terminee' || !!req.invoiceId}
                title={!job || job.status !== 'terminee' ? 'Disponible quand l’intervention est terminée' : undefined}
                onClick={() => createInvoice(req.id)}
              >
                <Receipt /> {req.invoiceId ? 'Facture créée' : 'Convertir en facture'}
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card className="min-w-0 self-start">
          <CardHeader title="Lignes du devis" subtitle={editable ? 'Pré-rempli depuis la qualification et la grille tarifaire. Modifiable avant envoi.' : 'Devis signé : modification impossible (créez un avenant).'} />
          <div className="scroll-thin overflow-x-auto px-4">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-left text-[12px] text-muted">
                <tr>
                  <th className="py-2 font-semibold">Désignation</th>
                  <th className="w-20 py-2 font-semibold">Qté</th>
                  <th className="w-28 py-2 font-semibold">PU HT (€)</th>
                  <th className="w-24 py-2 font-semibold">TVA</th>
                  <th className="w-24 py-2 text-right font-semibold">Total HT</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {q.lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="py-1.5 pr-2">
                      <Input id={`l-label-${l.id}`} aria-label="Désignation" value={l.label} disabled={!editable} onChange={(e) => patchLine(l.id, { label: e.target.value })} className="h-9" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input id={`l-qty-${l.id}`} aria-label="Quantité" type="number" step="0.5" min="0" value={l.quantity} disabled={!editable} onChange={(e) => patchLine(l.id, { quantity: Number(e.target.value) })} className="h-9 tnum" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input id={`l-pu-${l.id}`} aria-label="Prix unitaire HT" type="number" step="1" min="0" value={(l.unitPriceCents / 100).toFixed(2)} disabled={!editable} onChange={(e) => patchLine(l.id, { unitPriceCents: Math.round(Number(e.target.value) * 100) })} className="h-9 tnum" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Select id={`l-vat-${l.id}`} aria-label="TVA" value={l.vatRate} disabled={!editable} onChange={(e) => patchLine(l.id, { vatRate: Number(e.target.value) })} className="h-9">
                        <option value={20}>20 %</option>
                        <option value={10}>10 %</option>
                        <option value={5.5}>5,5 %</option>
                      </Select>
                    </td>
                    <td className="py-1.5 text-right font-semibold tnum">{money(Math.round(l.unitPriceCents * l.quantity))}</td>
                    <td className="py-1.5 text-right">
                      {editable && (
                        <Button size="icon-sm" variant="ghost" aria-label="Supprimer la ligne" onClick={() => setLines(q.lines.filter((x) => x.id !== l.id))}>
                          <Trash2 />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable && (
            <div className="flex flex-wrap items-end gap-2 px-4 pt-3">
              <Field label="Ajouter depuis le catalogue" htmlFor="add-item" className="min-w-0 flex-1">
                <Select id="add-item" value={addCode} onChange={(e) => setAddCode(e.target.value)}>
                  <option value="">Choisir une prestation ou une pièce…</option>
                  {catalog.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label} ({money(c.priceHtCents)} HT / {c.unit})
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                disabled={!addCode}
                onClick={() => {
                  const c = catalog.find((x) => x.code === addCode)!
                  setLines([...q.lines, { id: uid('l'), label: c.label, quantity: 1, unit: c.unit, unitPriceCents: c.priceHtCents, vatRate: address?.housingType === 'local_pro' ? 20 : 10, kind: c.kind }])
                  setAddCode('')
                }}
              >
                <Plus /> Ajouter
              </Button>
              <Button variant="ghost" onClick={() => setLines([...q.lines, { id: uid('l'), label: 'Ligne libre', quantity: 1, unit: 'u', unitPriceCents: 0, vatRate: 10, kind: 'service' }])}>
                Ligne libre
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-3">
            <Field label="Acompte" htmlFor="deposit">
              <Select id="deposit" value={q.depositPercent} disabled={!editable} onChange={(e) => updateQuote(q.id, { depositPercent: Number(e.target.value) })}>
                {[0, 20, 30, 40, 50].map((p) => (
                  <option key={p} value={p}>
                    {p ? `${p} % (paiement Stripe)` : 'Aucun'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Validité" htmlFor="validity">
              <Select id="validity" value={Math.round((q.validUntil - q.createdAt) / 86400000)} disabled={!editable} onChange={(e) => updateQuote(q.id, { validUntil: q.createdAt + Number(e.target.value) * 86400000 })}>
                {[7, 15, 30, 60].map((d) => (
                  <option key={d} value={d}>
                    {d} jours
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-col justify-end rounded bg-sunken p-3 text-right">
              <div className="text-[12px] text-muted">Total TTC</div>
              <div className="font-display text-2xl font-extrabold tnum">{money(t.ttc)}</div>
              <div className="text-[12px] text-muted tnum">dont TVA {money(t.vat)}</div>
            </div>
            <label className="flex items-start gap-2 text-sm sm:col-span-3">
              <input type="checkbox" id="urgent-waiver" className="mt-1 size-4 accent-[rgb(var(--accent))]" checked={q.urgentWaiver} disabled={!editable} onChange={(e) => updateQuote(q.id, { urgentWaiver: e.target.checked })} />
              <span>
                Dépannage urgent demandé par le client : mention de renonciation au délai de rétractation de 14 jours pour les travaux strictement nécessaires.
              </span>
            </label>
            {t.vatByRate.some(([r]) => r < 20) && (
              <p className="flex gap-2 rounded border border-info/30 bg-info-soft p-3 text-[13px] text-info sm:col-span-3">
                <Info className="mt-0.5 size-4 shrink-0" />
                TVA réduite : le client certifie que le logement a plus de 2 ans. La mention est ajoutée au devis et confirmée lors de la signature.
              </p>
            )}
          </div>
        </Card>
        <div className="min-w-0">
          <div className="label-caps mb-2 text-muted">Aperçu du PDF envoyé au client</div>
          <DocumentView
            kind="devis"
            refNo={q.ref}
            company={ds.company}
            client={client}
            address={address}
            lines={q.lines}
            issuedAt={q.sentAt ?? q.createdAt}
            validUntil={q.validUntil}
            depositPercent={q.depositPercent}
            urgentWaiver={q.urgentWaiver}
            signature={q.signature}
            signerName={q.signerName}
            signedAt={q.signedAt}
          />
        </div>
      </div>
      <Dialog open={signOpen} onOpenChange={setSignOpen} title="Signature sur place" description={`Montant : ${money(t.ttc)} TTC. Tendez la tablette au client.`}>
        <div className="space-y-3">
          <Field label="Nom du signataire" htmlFor="signer">
            <Input id="signer" value={signer} onChange={(e) => setSigner(e.target.value)} placeholder={`${client.firstName} ${client.lastName}`} />
          </Field>
          <SignaturePad onChange={setSig} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setSignOpen(false)}>Annuler</Button>
            <Button
              variant="primary"
              disabled={!sig}
              onClick={() => {
                signQuote(q.id, signer || `${client.firstName} ${client.lastName}`, sig!, q.urgentWaiver)
                setSignOpen(false)
              }}
            >
              Valider la signature
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
