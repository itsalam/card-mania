import { useCardQuery } from '@/client/card'
import { ExpandableCard } from '@/components/content-card'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { ListCard } from '@/components/tcg-card/views/ListCard'
import { cn } from '@/lib/utils'
import { useRecentViews } from '@/store/functions/hooks'
import { Database } from '@/store/supabase'
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
}) {
  const { data, loading, error } = useCardQuery(item.item_id)

  return (
    <ListCard
      isLoading={loading}
      expanded={isOpen}
      card={data}
      className={cn(isOpen && 'flex flex-row items-center gap-2 p-2 w-full')}
      {...props}
    />
  )
}

export function RecentlyViewed() {
  const { data: recentViews } = useRecentViews()

  return (
    <ExpandableCard
      title="Recently Viewed"
      itemWidth={ITEM_WIDTH}
      containerClassNames="gap-6 px-6"
      items={recentViews ?? []}
      renderItem={({ isOpen, item }) => <RecentlyViewedCard isOpen={isOpen} item={item} />}
    />
  )
}
