import { Button } from '../../lib/shadcn/button'
import { Alert, AlertDescription } from '../../lib/shadcn/alert'
import { EyeOff, Loader2, Pin, PinOff, Undo2 } from 'lucide-react'
import { cn } from '../../lib/shadcn/utils'
import { CardThumb } from './CardThumb'
import { formatCents } from '../../utils/promo'
import type { CardRef, MatchCard, MatchPreview as Matches } from '../../utils/promo'

type Props = {
  matches: Matches | null
  loading: boolean
  error: string | null
  minCards: number
  pinned: string[]
  excluded: string[]
  /** Names/thumbnails for pinned and excluded cards (from lookup_cards). */
  refs: Record<string, CardRef>
  onPin: (refId: string) => void
  onUnpin: (refId: string) => void
  onExclude: (refId: string) => void
  onRestore: (refId: string) => void
}

/** "Matches N listings" plus the cards in the order the app will show them, with pin/exclude. */
export function MatchPreview({ matches, loading, error, minCards, pinned, excluded, refs, onPin, onUnpin, onExclude, onRestore }: Props) {
  const count = matches?.count ?? 0
  const short = matches !== null && count < minCards

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium">
          {matches === null ? 'Matching listings' : `Matches ${count}${matches.count_capped ? '+' : ''} listing${count === 1 ? '' : 's'}`}
        </span>
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : null}
        {short ? (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Needs {minCards} to show cards. Until then the app shows “Coming soon”.
          </span>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {matches && matches.sample.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {matches.sample.map((c: MatchCard) => (
            <div key={`${c.rank}-${c.ref_id}`} className="group space-y-1">
              <div className="relative">
                <CardThumb card={c} className={cn('w-full', c.pinned && 'ring-2 ring-primary')} />
                {c.pinned ? (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    Pinned
                  </span>
                ) : null}
              </div>
              <div className="truncate text-xs" title={c.name}>
                {c.name}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {[formatCents(c.market_value), c.grading_company].filter(Boolean).join(' · ') || c.set_name}
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5"
                  aria-label={c.pinned ? `Unpin ${c.name}` : `Pin ${c.name}`}
                  onClick={() => (c.pinned ? onUnpin(c.ref_id) : onPin(c.ref_id))}
                >
                  {c.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5"
                  aria-label={`Exclude ${c.name}`}
                  onClick={() => onExclude(c.ref_id)}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : matches && !loading ? (
        <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          Nothing is listed for these criteria yet. That's normal before a release.
        </p>
      ) : null}

      {pinned.length > 0 ? (
        <RefList title="Pinned (always shown first)" ids={pinned} refs={refs} action="Unpin" icon={<PinOff className="w-3.5 h-3.5" />} onAction={onUnpin} />
      ) : null}
      {excluded.length > 0 ? (
        <RefList title="Excluded" ids={excluded} refs={refs} action="Restore" icon={<Undo2 className="w-3.5 h-3.5" />} onAction={onRestore} />
      ) : null}
    </div>
  )
}

function RefList({
  title,
  ids,
  refs,
  action,
  icon,
  onAction,
}: {
  title: string
  ids: string[]
  refs: Record<string, CardRef>
  action: string
  icon: React.ReactNode
  onAction: (id: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs">
            {refs[id]?.name ?? `${id.slice(0, 8)}…`}
            <button
              type="button"
              aria-label={`${action} ${refs[id]?.name ?? id}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onAction(id)}
            >
              {icon}
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
