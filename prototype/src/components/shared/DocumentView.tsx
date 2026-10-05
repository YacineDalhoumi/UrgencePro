// Rendu « PDF » d'un devis ou d'une facture, aux couleurs de l'entreprise (en production : react-pdf côté serveur).
import type { Client, Company, DocLine, Address } from '@/data/types'
import { totals } from '@/data/pricing'
import { CATALOG } from '@/data/reference'
import { dateFr, money, phone, timeFr } from '@/lib/utils'

export function DocumentView({
  kind,
  refNo,
  company,
  client,
  address,
  lines,
  issuedAt,
  validUntil,
  dueAt,
  depositPercent,
  urgentWaiver,
  signature,
  signerName,
  signedAt,
  compact,
}: {
  kind: 'devis' | 'facture'
  refNo: string
  company: Company
  client: Client
  address?: Address
  lines: DocLine[]
  issuedAt: number
  validUntil?: number
  dueAt?: number
  depositPercent?: number
  urgentWaiver?: boolean
  signature?: string
  signerName?: string
  signedAt?: number
  compact?: boolean
}) {
  const t = totals(lines)
  const travel = CATALOG.filter((c) => c.kind === 'travel')
  const reduced = t.vatByRate.some(([r]) => r < 20)
  return (
    <div className="rounded border border-slate-300 bg-white text-[12px] leading-snug text-slate-800 shadow-sm" style={{ fontFamily: '"Atkinson Hyperlegible Next", system-ui, sans-serif' }}>
      <div className="h-2 rounded-t" style={{ background: company.brandColor }} />
      <div className={compact ? 'p-4' : 'p-6'}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded text-lg font-extrabold text-white" style={{ background: company.brandColor, fontFamily: '"Bricolage Grotesque", sans-serif' }}>
              {company.shortName[0]}
            </span>
            <div>
              <div className="text-[15px] font-bold" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
                {company.name}
              </div>
              <div className="text-slate-500">{company.legalName}</div>
              <div className="text-slate-500">{company.address}</div>
              <div className="text-slate-500">
                {phone(company.phone)} · {company.email}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[18px] font-extrabold uppercase tracking-wide" style={{ color: company.brandColor, fontFamily: '"Bricolage Grotesque", sans-serif' }}>
              {kind === 'devis' ? 'Devis' : 'Facture'}
            </div>
            <div className="font-mono text-[12px]">{refNo}</div>
            <div className="text-slate-500">Date : {dateFr(issuedAt, 'dd/MM/yyyy')}</div>
            {validUntil && <div className="text-slate-500">Valable jusqu’au {dateFr(validUntil, 'dd/MM/yyyy')}</div>}
            {dueAt && <div className="text-slate-500">Échéance : {dateFr(dueAt, 'dd/MM/yyyy')}</div>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded bg-slate-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Client</div>
            <div className="font-semibold">{client.companyName ?? `${client.firstName} ${client.lastName}`}</div>
            {client.companyName && <div>À l’attention de {client.firstName} {client.lastName}</div>}
            <div className="tnum">{phone(client.phone)}</div>
          </div>
          {address && (
            <div className="rounded bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lieu d’intervention</div>
              <div>{address.line1}</div>
              <div>
                {address.postalCode} {address.city}
                {address.floor && ` · ${address.floor}`}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[460px]">
            <thead>
              <tr className="border-b-2 text-left text-[11px] uppercase tracking-wide text-slate-500" style={{ borderColor: company.brandColor }}>
                <th className="py-1.5 font-bold">Désignation</th>
                <th className="py-1.5 text-right font-bold">Qté</th>
                <th className="py-1.5 text-right font-bold">PU HT</th>
                <th className="py-1.5 text-right font-bold">TVA</th>
                <th className="py-1.5 text-right font-bold">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-slate-200">
                  <td className="py-1.5 pr-2">{l.label}</td>
                  <td className="py-1.5 text-right tnum">
                    {String(l.quantity).replace('.', ',')} {l.unit}
                  </td>
                  <td className="py-1.5 text-right tnum">{money(l.unitPriceCents)}</td>
                  <td className="py-1.5 text-right tnum">{String(l.vatRate).replace('.', ',')} %</td>
                  <td className="py-1.5 text-right tnum">{money(Math.round(l.unitPriceCents * l.quantity))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex justify-end">
          <table className="min-w-[220px] tnum">
            <tbody>
              <tr>
                <td className="py-0.5 pr-6 text-slate-500">Total HT</td>
                <td className="py-0.5 text-right">{money(t.ht)}</td>
              </tr>
              {t.vatByRate.map(([rate, v]) => (
                <tr key={rate}>
                  <td className="py-0.5 pr-6 text-slate-500">TVA {String(rate).replace('.', ',')} %</td>
                  <td className="py-0.5 text-right">{money(v)}</td>
                </tr>
              ))}
              <tr className="border-t-2" style={{ borderColor: company.brandColor }}>
                <td className="pt-1 pr-6 text-[14px] font-bold">Total TTC</td>
                <td className="pt-1 text-right text-[14px] font-bold">{money(t.ttc)}</td>
              </tr>
              {!!depositPercent && (
                <tr>
                  <td className="py-0.5 pr-6 text-slate-500">Acompte à la signature ({depositPercent} %)</td>
                  <td className="py-0.5 text-right">{money(Math.round((t.ttc * depositPercent) / 100))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-3 text-[11px] text-slate-600">
          <p>
            <b>Tarifs affichés :</b> taux horaire {money(Math.round(company.hourlyRateCents * 1.1))} TTC · déplacement {travel.map((tr) => `${tr.label.replace('Déplacement ', '')} ${money(Math.round(tr.priceHtCents * 1.1))} TTC`).join(', ')} · majorations nuit +50 %, dimanche et fériés +50 %, samedi après-midi +25 %.
          </p>
          {reduced && <p><b>TVA à taux réduit :</b> applicable aux travaux dans un logement achevé depuis plus de 2 ans, sous réserve de l’attestation du client jointe au présent document.</p>}
          {kind === 'devis' && (
            <>
              <p><b>Paiement :</b> à réception, par carte bancaire, chèque ou espèces dans la limite légale. {depositPercent ? `Acompte de ${depositPercent} % à la signature.` : ''}</p>
              <p>
                <b>Droit de rétractation :</b> 14 jours pour un contrat conclu à domicile.
                {urgentWaiver ? ' Le client demande expressément une intervention immédiate pour un dépannage urgent et reconnaît que le droit de rétractation ne s’applique pas aux travaux strictement nécessaires.' : ''}
              </p>
            </>
          )}
          {kind === 'facture' && <p><b>Pénalités de retard :</b> taux légal × 3 ; indemnité forfaitaire de recouvrement de 40 € (clients professionnels). Pas d’escompte pour paiement anticipé.</p>}
          <p>
            SIRET {company.siret} · TVA {company.vatNumber} · {company.insurance}
          </p>
        </div>

        {kind === 'devis' && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded border border-slate-200 p-3 text-[11px] text-slate-500">Devis gratuit. Bon pour accord : date, signature et mention « lu et approuvé ».</div>
            <div className="flex min-h-[90px] flex-col justify-between rounded border border-slate-200 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Signature du client</div>
              {signature ? (
                <>
                  <img src={signature} alt="Signature du client" className="h-14 object-contain object-left" />
                  <div className="text-[10px] text-slate-500">
                    {signerName} · signé électroniquement le {dateFr(signedAt!, 'dd/MM/yyyy')} à {timeFr(signedAt!)} · horodaté, empreinte SHA-256 conservée
                  </div>
                </>
              ) : signedAt ? (
                <div className="text-[11px] text-emerald-700">Signé électroniquement par {signerName} le {dateFr(signedAt, 'dd/MM/yyyy')} à {timeFr(signedAt)}</div>
              ) : (
                <div className="text-[11px] text-slate-400">En attente de signature</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
