import { useCardQuery } from '@/client/card'
import { useIsWishlisted } from '@/client/card/wishlist'
import { ExpandableCard } from '@/components/content-card'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '@/components/tcg-card/consts'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { CardListView } from '@/components/tcg-card/views/ListCard'
import { Text } from '@/components/ui/text'
import { useRecentViews } from '@/lib/store/functions/hooks'
import { Database } from '@/lib/store/supabase'
import { History } from 'lucide-react-native'
import React, { ComponentProps } from 'react'
import { Colors } from 'react-native-ui-lib'

const EXPANDED_CARD_HEIGHT = THUMBNAIL_HEIGHT + 24

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

  return <CardListView isLoading={loading} expanded={isOpen} card={data} {...props} />
}

export function RecentlyViewed() {
  const { data: recentViews } = useRecentViews()

  const { data: wishlistedIds, error } = useIsWishlisted(
    'card',
    recentViews?.map((item) => item.item_id) || []
  )

  return (
    <ExpandableCard
      title={
        <>
          <History color={Colors.$iconDefault} size={32} />
          <Text variant="h3" className="flex-1">
            {'Recently Viewed'}
          </Text>
        </>
      }
      itemWidth={THUMBNAIL_WIDTH}
      items={recentViews ?? []}
      renderItem={({ isOpen, item }, index) => (
        <RecentlyViewedCard
          isOpen={isOpen}
          item={item}
          isWishlisted={wishlistedIds?.has(item.item_id) ?? false}
        />
      )}
    />
  )
}
