import { ExpandableCard } from '@/components/content-card'
import { ExpandedContent } from '@/components/content-card/ExpandableCard'
import { SearchBar } from '@/components/search-bar'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { Card } from '@/components/ui/card/index'
import { HStack } from '@/components/ui/hstack'
import { cn } from '@/lib/utils'
import React, { ComponentProps } from 'react'
import { SafeAreaView, ScrollView } from 'react-native'

const ITEM_WIDTH = 96
const ITEM_ASPECT_RATIO = 5 / 7
const CONDENSED_ITEM_HEIGHT = ITEM_WIDTH / ITEM_ASPECT_RATIO
const EXPANDED_CARD_HEIGHT = CONDENSED_ITEM_HEIGHT + 24

export function PlaceholderBox({
  isOpen = false,
  className,
  ...props
}: ComponentProps<typeof LiquidGlassCard> & { isOpen?: boolean }) {
  return (
    <HStack className={cn('gap-4 flex relative', isOpen && 'min-w-full')}>
      <LiquidGlassCard variant="primary" {...props} className={className} />
      {isOpen && <ExpandedContent />}
    </HStack>
  )
}

export default function MarketplaceScreen() {
  return (
    <SafeAreaView className="flex-1">
      <SearchBar />
      <ScrollView>
        <ExpandableCard
          title="Featured"
          itemWidth={ITEM_WIDTH}
          containerClassNames="gap-6 px-6"
          items={[]}
          renderItem={({ isOpen }) => (
            <PlaceholderBox
              isOpen={isOpen}
              style={{
                height: isOpen ? EXPANDED_CARD_HEIGHT : CONDENSED_ITEM_HEIGHT,
                aspectRatio: ITEM_ASPECT_RATIO,

                zIndex: 0,
              }}
            />
          )}
        />
        <Card>
                    <ExpandableCard
          title="Auctions - Graded"
          itemWidth={ITEM_WIDTH}
          containerClassNames="gap-6 px-6"
          items={[]}
          renderItem={({ isOpen }) => (
            <PlaceholderBox
              isOpen={isOpen}
              style={{
                height: isOpen ? EXPANDED_CARD_HEIGHT : CONDENSED_ITEM_HEIGHT,
                aspectRatio: ITEM_ASPECT_RATIO,

                zIndex: 0,
              }}
            />
          )}
        />

                    <ExpandableCard
          title="Auctions - Sealed"
          itemWidth={ITEM_WIDTH}
            containerClassNames="gap-6 px-6"
            items={[]}
          renderItem={({ isOpen }) => (
            <PlaceholderBox
              isOpen={isOpen}
              style={{
                height: isOpen ? EXPANDED_CARD_HEIGHT : CONDENSED_ITEM_HEIGHT,
                aspectRatio: ITEM_ASPECT_RATIO,

                zIndex: 0,
              }}
            />
          )}
        />
        </Card>

      </ScrollView>
    </SafeAreaView>
  )
}
