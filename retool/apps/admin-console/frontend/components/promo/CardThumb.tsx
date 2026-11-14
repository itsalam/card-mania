import { useState } from 'react'
import { cn } from '../../lib/shadcn/utils'
import { cardImageUrl } from '../../utils/promo'

type Props = {
  card: { name: string; image_path: string | null; image_source_url: string | null }
  className?: string
}

/** A trading-card-shaped thumbnail (5:7) with a text fallback when there's no image. */
export function CardThumb({ card, className }: Props) {
  const [failed, setFailed] = useState(false)
  const src = cardImageUrl(card)
  return (
    <div
      className={cn('relative aspect-[5/7] shrink-0 overflow-hidden rounded-md border border-border bg-muted', className)}
      title={card.name}
    >
      {src && !failed ? (
        <img src={src} alt={card.name} loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-1 text-center text-[9px] leading-tight text-muted-foreground">
          {card.name}
        </div>
      )}
    </div>
  )
}
