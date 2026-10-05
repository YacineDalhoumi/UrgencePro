import * as React from 'react'
import { Link } from 'react-router-dom'
import { Info, Sparkles, MessageSquareReply } from 'lucide-react'
import { useStore } from '@/store/store'
import { useLookups } from '@/store/hooks'
import { Button } from '@/components/ui/button'
import { Badge, Card, Dialog, Textarea } from '@/components/ui/primitives'
import { PageHeader, Stars, TechChip } from '@/components/shared/bits'
import type { Review } from '@/data/types'
import { cn, dateFr, n } from '@/lib/utils'

const FILTERS = [
  { key: 'tous', label: 'Tous' },
  { key: 'google', label: 'Google' },
  { key: 'interne', label: 'Retours internes' },
  { key: 'bas', label: 'Notes ≤ 3' },
]

export function ReviewsPage() {
  const { ds, techs } = useLookups()
  const [f, setF] = React.useState('tous')
  const [limit, setLimit] = React.useState(20)
  const [replying, setReplying] = React.useState<Review | null>(null)
  const reviews = ds.reviews.slice().sort((a, b) => b.at - a.at)
  const rows = reviews.filter((r) => f === 'tous' || (f === 'bas' ? r.rating <= 3 : r.source === f))
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, c: reviews.filter((r) => r.rating === s).length }))
  const avg = reviews.reduce((a, r) => a + r.rating, 0) / Math.max(1, reviews.length)

  return (
    <div>
      <PageHeader title="Avis et réputation" subtitle="Avis Google et retours privés, centralisés." />
      <div className="mb-3 flex gap-2 rounded border border-info/30 bg-info-soft p-3 text-[13px] text-info">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Tous les clients reçoivent la même demande d’avis, avec le lien Google <b>et</b> un formulaire de retour privé. Filtrer les clients selon leur note (« review gating ») est interdit par Google. Une note interne de 3 ou moins déclenche une alerte au gérant pour rappeler le client.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <div className="label-caps text-muted">Fiche Google</div>
          <div className="mt-1 flex items-end gap-3">
            <span className="font-display text-4xl font-extrabold tnum">{ds.company.googleRating.toFixed(1).replace('.', ',')}</span>
            <span className="pb-1">
              <Stars value={ds.company.googleRating} size={16} />
              <span className="block text-[12px] text-muted">{n(ds.company.googleReviewCount)} avis</span>
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="label-caps text-muted">Note moyenne (6 mois)</div>
          <div className="mt-1 font-display text-4xl font-extrabold tnum">{avg.toFixed(2).replace('.', ',')}</div>
          <div className="text-[12px] text-muted">{n(reviews.length)} avis reçus via UrgencePro</div>
        </Card>
        <Card className="p-4">
          <div className="space-y-1">
            {dist.map((d) => (
              <div key={d.s} className="flex items-center gap-2 text-[12px]">
                <span className="w-3 font-semibold tnum">{d.s}</span>
                <div className="h-2 flex-1 rounded-sm bg-sunken">
                  <div className="h-full rounded-sm bg-warn" style={{ width: `${(d.c / Math.max(1, reviews.length)) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-muted tnum">{d.c}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mb-3 mt-5 flex gap-1">
        {FILTERS.map((x) => (
          <button key={x.key} onClick={() => setF(x.key)} className={cn('h-8 rounded-full border px-3 text-[13px] font-semibold', f === x.key ? 'border-ink bg-ink text-ink-fg' : 'border-border bg-surface text-muted hover:text-fg')}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rows.slice(0, limit).map((r) => (
          <Card key={r.id} className={cn('p-4', r.rating <= 3 && 'border-bad/40')}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  <Badge tone={r.source === 'google' ? 'info' : 'neutral'}>{r.source === 'google' ? 'Google' : 'Retour privé'}</Badge>
                  {r.rating <= 3 && <Badge tone="bad">À rappeler</Badge>}
                </div>
                <div className="mt-1 text-[13px] text-muted">
                  {r.author} · {dateFr(r.at)}
                </div>
              </div>
              {r.technicianId && <TechChip tech={techs.get(r.technicianId)} size={22} />}
            </div>
            <p className="mt-2 text-sm">« {r.comment} »</p>
            {r.reply && <p className="mt-2 border-l-2 border-border pl-3 text-[13px] text-muted">Réponse : {r.reply}</p>}
            <div className="mt-2 flex gap-3">
              {r.source === 'google' && !r.reply && (
                <Button size="sm" onClick={() => setReplying(r)}>
                  <MessageSquareReply /> Répondre
                </Button>
              )}
              {r.requestId && (
                <Link to={`/demandes/${r.requestId}`} className="self-center text-[13px] font-semibold text-accent hover:underline">
                  Intervention
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>
      {rows.length > limit && (
        <div className="mt-3 text-center">
          <Button size="sm" onClick={() => setLimit((l) => l + 20)}>
            Afficher plus
          </Button>
        </div>
      )}
      <ReplyDialog review={replying} onClose={() => setReplying(null)} />
    </div>
  )
}

function ReplyDialog({ review, onClose }: { review: Review | null; onClose: () => void }) {
  const reply = useStore((s) => s.replyReview)
  const [text, setText] = React.useState('')
  React.useEffect(() => {
    if (review) setText(review.rating >= 4 ? `Merci ${review.author.split(' ')[0]} pour ce retour ! Toute l’équipe est ravie d’avoir pu vous dépanner rapidement. À bientôt.` : `Bonjour ${review.author.split(' ')[0]}, merci pour votre retour. Nous sommes désolés que l’intervention ne vous ait pas pleinement satisfait. Nous vous rappelons pour en parler.`)
  }, [review])
  if (!review) return null
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Répondre à l’avis Google" description="Réponse publique, publiée sur votre fiche.">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-ai">
        <Sparkles className="size-3.5" /> Brouillon proposé par l’IA, modifiable
      </div>
      <Textarea id="review-reply" value={text} onChange={(e) => setText(e.target.value)} className="min-h-32" />
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="primary"
          onClick={() => {
            reply(review.id, text)
            onClose()
          }}
        >
          Publier la réponse
        </Button>
      </div>
    </Dialog>
  )
}
