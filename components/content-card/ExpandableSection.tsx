import { cn } from '@/lib/utils'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { LucideIcon } from 'lucide-react-native'
import React, { useCallback, useState } from 'react'
import { LayoutChangeEvent, ScrollView, View } from 'react-native'
import { CARD_ASPECT_RATIO } from '../consts'
import { SectionHeader } from '../ui/section-header'

// The collapsed rail's content View (below) carries this padding — a measured item's height
// needs it added back to get the container height that actually fits the item.
const ROW_VERTICAL_PADDING = 16 * 2

export type ExpandableSectionResult = {
  header: React.ReactNode
  body: React.ReactNode
  isOpen: boolean
}

type UseExpandableSectionArgs<T extends { id: string }> = {
  icon?: LucideIcon
  title: string
  items: T[]
  renderItem: (args: { item: T; isOpen?: boolean }, index: number) => React.ReactNode
  itemWidth?: number
  containerClassNames?: string
  /** When false, this section is rail-only — the header hides its "See all" affordance and
   *  never opens. Driven per-section by home_feed_section_meta.layout.expandable. */
  expandable?: boolean
}

/**
 * Home-feed section (ITS-107 momentum follow-up): unlike the self-contained `ExpandableCard`
 * (still used as-is by RecentlyViewed), this returns header/body as separate nodes so FeedPage
 * can flatten them into the page's single outer ScrollView, with headers pinned via that
 * ScrollView's `stickyHeaderIndices`. The expanded body has no inner ScrollView/height clamp —
 * same-axis nested ScrollViews don't hand off scroll momentum in RN, so this keeps everything on
 * one real scrolling surface instead.
 */
export function useExpandableSection<T extends { id: string }>({
  icon,
  title,
  items,
  renderItem,
  itemWidth = 72,
  containerClassNames,
  expandable = true,
}: UseExpandableSectionArgs<T>): ExpandableSectionResult {
  const [isOpenState, setIsOpenState] = useState(false)
  const isOpen = expandable && isOpenState
  const toggle = useCallback(() => {
    if (expandable) setIsOpenState((o) => !o)
  }, [expandable])

  // Collapsed rail height is still measured from the actual rendered items rather than hand-
  // computed — see ExpandableCard's own writeup for why. The expanded state no longer needs an
  // equivalent height at all: it's unclamped, so it just grows to its natural content height.
  const [measuredItemHeight, setMeasuredItemHeight] = useState<number | null>(null)
  const fallbackItemHeight = itemWidth / CARD_ASPECT_RATIO + 24
  const railHeight = measuredItemHeight ?? fallbackItemHeight

  const handleItemLayout = useCallback((e: LayoutChangeEvent) => {
    const height = Math.ceil(e.nativeEvent.layout.height) + ROW_VERTICAL_PADDING
    setMeasuredItemHeight((prev) => (prev != null && prev >= height ? prev : height))
  }, [])

  const header = (
    <SectionHeader
      icon={icon}
      title={title}
      isOpen={isOpen}
      onToggle={toggle}
      expandable={expandable}
    />
  )

  const body = isOpen ? (
    <View className={cn('flex flex-col gap-y-4 p-4', containerClassNames)}>
      {items.map((item, i) => (
        <View key={`${item?.id}-${i}`}>{renderItem({ item, isOpen: true }, i)}</View>
      ))}
    </View>
  ) : (
    <MaskedView
      className={cn('z-0 overflow-visible min-w-max')}
      style={{ height: railHeight, maxWidth: '100%', overflow: 'visible' }}
      maskElement={
        <LinearGradient
          // MaskedView uses the alpha channel: solid shows content, transparent hides it.
          colors={['transparent', 'black', 'black', 'transparent']}
          start={{ x: 0.0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          locations={[0, 0.025, 0.9, 1]}
          style={{ position: 'relative', height: '100%', width: '100%', top: '-2.5%', left: '-0%' }}
        />
      }
    >
      <ScrollView
        horizontal
        decelerationRate="fast"
        snapToInterval={itemWidth}
        snapToAlignment="start"
        className="overflow-visible"
      >
        <View className={cn('gap-x-2.5 gap-y-4 p-4 flex flex-row', containerClassNames)}>
          {items.map((item, i) => (
            <View
              key={`${item?.id}-${i}`}
              // flex-start, not the row's default stretch — see ExpandableCard's own writeup;
              // same feedback-loop bug applies here since this is the same rail pattern.
              style={{ alignSelf: 'flex-start' }}
              onLayout={handleItemLayout}
            >
              {renderItem({ item, isOpen: false }, i)}
            </View>
          ))}
        </View>
      </ScrollView>
    </MaskedView>
  )

  return { header, body, isOpen }
}
