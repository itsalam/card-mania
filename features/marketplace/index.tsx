import { CARD_ASPECT_RATIO } from '@/components/consts'
import { ExpandableCard } from '@/components/content-card'
import { ExpandedContent } from '@/components/content-card/ExpandableCard'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '@/components/tcg-card/consts'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { cn } from '@/lib/utils'
import React, { ComponentProps } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const EXPANDED_CARD_HEIGHT = THUMBNAIL_HEIGHT + 24

export function PlaceholderBox({
  isOpen = false,
  className,
  ...props
}: ComponentProps<typeof LiquidGlassCard> & { isOpen?: boolean }) {
  return (
    <View className={cn('gap-4 flex relative flex-row', isOpen && 'min-w-full')}>
      <LiquidGlassCard variant="primary" {...props} className={className} />
      {isOpen && <ExpandedContent />}
    </View>
  )
}

export default function MarketplaceScreen() {
  return (
    <SafeAreaView className="flex-1">
      <ScrollView>
        <ExpandableCard
          title="Featured"
          itemWidth={THUMBNAIL_WIDTH}
          containerClassNames="gap-6 px-6"
          items={[]}
          renderItem={({ isOpen }) => (
            <PlaceholderBox
              isOpen={isOpen}
              style={{
                height: isOpen ? EXPANDED_CARD_HEIGHT : THUMBNAIL_HEIGHT,
                aspectRatio: CARD_ASPECT_RATIO,

                zIndex: 0,
              }}
            />
          )}
        />
        <View>
          <ExpandableCard
            title="Auctions - Graded"
            itemWidth={THUMBNAIL_WIDTH}
            containerClassNames="gap-6 px-6"
            items={[]}
            renderItem={({ isOpen }) => (
              <PlaceholderBox
                isOpen={isOpen}
                style={{
                  height: isOpen ? EXPANDED_CARD_HEIGHT : THUMBNAIL_HEIGHT,
                  aspectRatio: CARD_ASPECT_RATIO,

                  zIndex: 0,
                }}
              />
            )}
          />

          <ExpandableCard
            title="Auctions - Sealed"
            itemWidth={THUMBNAIL_WIDTH}
            containerClassNames="gap-6 px-6"
            items={[]}
            renderItem={({ isOpen }) => (
              <PlaceholderBox
                isOpen={isOpen}
                style={{
                  height: isOpen ? EXPANDED_CARD_HEIGHT : THUMBNAIL_HEIGHT,
                  aspectRatio: CARD_ASPECT_RATIO,

                  zIndex: 0,
                }}
              />
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
