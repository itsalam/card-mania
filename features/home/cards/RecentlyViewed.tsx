import { useCardQuery } from '@/client/card'
import { useIsWishlisted } from '@/client/card/wishlist'
import { ExpandableCard } from '@/components/content-card'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { ListCard } from '@/components/tcg-card/views/ListCard'
import { useRecentViews } from '@/lib/store/functions/hooks'
import { Database } from '@/lib/store/supabase'
import React, { ComponentProps } from 'react'

const ITEM_WIDTH = 96
const ITEM_ASPECT_RATIO = 5 / 7
const CONDENSED_ITEM_HEIGHT = ITEM_WIDTH / ITEM_ASPECT_RATIO
const EXPANDED_CARD_HEIGHT = CONDENSED_ITEM_HEIGHT + 24

export function RecentlyViewedCard({
  isOpen = false,
  item,
  ...props
}: ComponentProps<typeof LiquidGlassCard> & {
  isOpen?: boolean
  item: Database['public']['Tables']['recent_views']['Row']
  isWishlisted?: boolean
}) {
  const { data, loading, error } = useCardQuery(item.item_id)

  if (error || !data) {
    return null
  }

  return <ListCard isLoading={loading} expanded={isOpen} card={data} {...props} />
}

export function RecentlyViewed() {
  const { data: recentViews } = useRecentViews()

  const { data: wishlistedIds, error } = useIsWishlisted(
    'card',
    recentViews?.map((item) => item.item_id) || []
  )

  return (
    <ExpandableCard
      title="Recently Viewed"
      itemWidth={ITEM_WIDTH}
      containerClassNames="gap-6 px-6"
      items={recentViews ?? []}
      renderItem={({ isOpen, item }, index) => (
        <RecentlyViewedCard
          isOpen={isOpen}
          item={item}
          isWishlisted={wishlistedIds?.has(`${item.item_id}`) ?? false}
        />
      )}
    />
  )
}
