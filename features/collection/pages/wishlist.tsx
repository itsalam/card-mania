import { useIsWishlisted, useWishlistCardsEnriched } from '@/client/card/wishlist'
import { ListCard } from '@/components/tcg-card/views/ListCard'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { ScrollView, View } from 'react-native'

export const WishlistPage = () => {
  const { query, viewParams } = useWishlistCardsEnriched({ pageSize: 20 })
  const { data: items } = query
  const cards = useMemo(() => items?.pages.flat() ?? [], [items])
  const { data: wishlistedIds, error } = useIsWishlisted(
    'card',
    cards?.map((item) => item.id) || []
  )

  return (
    <View className="flex-1 flex flex-col gap-2 overflow-hidden pt-4">
      <ScrollView decelerationRate="fast" disableIntervalMomentum className="overflow-visible">
        <View className={cn('gap-y-4 px-4 flex flex-col')}>
          {cards.map((card) => (
            <View key={card.id} className="w-full">
              <ListCard
                card={card}
                expanded
                isWishlisted={wishlistedIds?.has(`${card.id}`) ?? false}
                viewParams={viewParams}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
