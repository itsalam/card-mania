import { useFeaturedListings } from '@/client/marketplace'
import { ExpandableCard } from '@/components/content-card'
import { THUMBNAIL_WIDTH } from '@/components/tcg-card/consts'
import React from 'react'
import { ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FeaturedCard } from './FeaturedCard'

export default function MarketplaceScreen() {
  const { data: rawListings = [] } = useFeaturedListings()
  const listings = rawListings.map((l) => ({ ...l, id: l.collection_item_id }))
  const graded = listings.filter((l) => l.grading_company !== null)
  const sealed = listings.filter((l) => l.item_kind !== 'card')

  return (
    <SafeAreaView className="flex-1">
      <ScrollView>
        <ExpandableCard
          title="Featured"
          itemWidth={THUMBNAIL_WIDTH}
          containerClassNames="gap-4 px-6"
          items={listings}
          renderItem={({ item, isOpen }) => <FeaturedCard item={item} isOpen={isOpen} />}
        />
        <ExpandableCard
          title="Auctions - Graded"
          itemWidth={THUMBNAIL_WIDTH}
          containerClassNames="gap-4 px-6"
          items={graded}
          renderItem={({ item, isOpen }) => <FeaturedCard item={item} isOpen={isOpen} />}
        />
        <ExpandableCard
          title="Auctions - Sealed"
          itemWidth={THUMBNAIL_WIDTH}
          containerClassNames="gap-4 px-6"
          items={sealed}
          renderItem={({ item, isOpen }) => <FeaturedCard item={item} isOpen={isOpen} />}
        />
      </ScrollView>
    </SafeAreaView>
  )
}
