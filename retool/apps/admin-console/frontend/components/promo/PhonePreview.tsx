import { useEffect, useState } from 'react'
import { cn } from '../../lib/shadcn/utils'
import { CardThumb } from './CardThumb'
import { ACCENTS, BADGES, countdown, promoAssetUrl, previewMode } from '../../utils/promo'
import type { MatchCard, Promo } from '../../utils/promo'

type Props = {
  promo: Promo
  showCards: boolean
  matchCount: number | null
  sample: MatchCard[]
}

/**
 * An approximation of the promo on the app's Home feed. The real rendering (ITS-192) lives in
 * the app; this mirrors its modes so the editor can see what changes as fields change.
 */
export function PhonePreview({ promo, showCards, matchCount, sample }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const mode = previewMode(promo, showCards, matchCount)
  const accent = ACCENTS.find((a) => a.value === promo.accent)?.swatch ?? '#3b82f6'
  const badge = BADGES.find((b) => b.value === promo.badge)?.label
  const hero = promoAssetUrl(promo.hero_image_path)
  const until = countdown(promo.release_date, now)
  const isHero = promo.placement === 'home_hero'

  return (
    <div className="mx-auto w-[300px] rounded-[2.25rem] border-[10px] border-neutral-900 bg-neutral-950 shadow-xl">
      <div className="h-[560px] overflow-y-auto rounded-[1.6rem] bg-neutral-950 px-3 pb-4 pt-6 text-white">
        <div className="mb-3 flex items-center justify-between px-1 text-[11px] text-white/60">
          <span>Home</span>
          <span>{isHero ? 'Hero' : 'Feed rail'}</span>
        </div>

        <div
          className="overflow-hidden rounded-2xl border border-white/10"
          style={{ background: `linear-gradient(160deg, ${accent}55, #0a0a0a 70%)` }}
        >
          {hero ? (
            <img src={hero} alt="" className={cn('w-full object-cover', isHero ? 'aspect-[16/10]' : 'aspect-[16/7]')} />
          ) : (
            <div className={cn('w-full', isHero ? 'aspect-[16/10]' : 'aspect-[16/7]')} style={{ background: `${accent}66` }} />
          )}

          <div className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              {badge ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: accent }}>
                  {badge}
                </span>
              ) : null}
              {mode === 'coming_soon' && until ? (
                <span className="text-[11px] text-white/70">Releases in {until}</span>
              ) : null}
            </div>
            <div className={cn('font-semibold leading-tight', isHero ? 'text-lg' : 'text-base')}>
              {promo.title || 'Title'}
            </div>
            {promo.subtitle ? <div className="text-xs text-white/75">{promo.subtitle}</div> : null}
            {promo.body && isHero ? <div className="text-xs leading-snug text-white/60">{promo.body}</div> : null}

            {mode === 'cards' ? (
              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pt-1">
                {sample.slice(0, 8).map((c) => (
                  <CardThumb key={`${c.rank}-${c.ref_id}`} card={c} className="w-16 border-white/10" />
                ))}
              </div>
            ) : mode === 'coming_soon' ? (
              <div className="rounded-lg border border-dashed border-white/20 px-3 py-2 text-center text-[11px] text-white/60">
                {until ? 'Coming soon. Cards appear after release.' : `Coming soon. Waiting for ${promo.min_cards}+ listings.`}
              </div>
            ) : null}

            {promo.cta?.label ? (
              <div className="pt-1">
                <span className="inline-block rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: accent }}>
                  {promo.cta.label}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 space-y-2 opacity-40">
          <div className="h-3 w-24 rounded bg-white/20" />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[5/7] w-16 rounded-md bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
