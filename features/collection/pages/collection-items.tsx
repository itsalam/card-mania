import { ItemListView } from '@/components/tcg-card/views/ListCard'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { useGetCollectionItems } from '../hooks'
import { PageTypes } from '../provider'

export const WishlistPage = ({
  collectionId,
  collectionType,
}: {
  collectionId?: string
  collectionType: PageTypes
}) => {
  const { query } = useGetCollectionItems({ collectionId, collectionType })

  const { data: items } = query
  const cards = useMemo(() => items?.pages.flat() ?? [], [items])

  return (
    <View className="flex-1 flex flex-col gap-2 overflow-hidden pt-4">
      <ScrollView decelerationRate="fast" disableIntervalMomentum className="overflow-visible">
        <View className={cn('gap-y-4 px-4 flex flex-col')}>
          {cards.map((card) => (
            <View key={card.id} className="w-full">
              <ItemListView
                item={card}
                expanded
                // isWishlisted={wishlistedIds?.has(`${card.id}`) ?? false}
                displayData={}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
