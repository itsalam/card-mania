import { cn } from '@/lib/utils'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { LucideIcon } from 'lucide-react-native'
import React, { ComponentProps, useCallback, useState } from 'react'
import { LayoutChangeEvent, ScrollView, View } from 'react-native'
import { CARD_ASPECT_RATIO } from '../consts'
import { SectionHeader } from '../ui/section-header'
import { Text } from '../ui/text/base-text'

export function PlaceholderBox({
  isOpen = false,
  className,
  ...props
}: ComponentProps<typeof View> & { isOpen?: boolean }) {
  return (
    <View className={cn('gap-6 flex flex-row', isOpen && 'min-w-full')}>
      <View {...props} className={cn(className, 'rounded-lg')} />
      {isOpen && <ExpandedContent />}
    </View>
  )
}

export const ExpandedContent = () => {
  return (
    <View className="flex-1">
      <Text variant="large">Placeholder box.</Text>
      <Text>You can replace this with any content you like, such as a card or an image.</Text>
    </View>
  )
}

// The collapsed rail's content View (below) carries this padding — a measured item's height
// needs it added back to get the container height that actually fits the item.
const ROW_VERTICAL_PADDING = 16 * 2

type ExpandableCardProps<T extends object> = {
  icon?: LucideIcon
  title: string
  items: T[]
  renderItem: ({ item, isOpen }: { item: T; isOpen?: boolean }, index: number) => React.ReactNode
  itemWidth?: number
  getExpandedHeight?: (itemWidth: number) => number
  containerClassNames?: string
  /** When false, this section is rail-only — SectionHeader hides its "See all" affordance and
   *  the card never opens. Driven per-section by home_feed_section_meta.layout.expandable. */
  expandable?: boolean
} & ComponentProps<typeof View>

export function ExpandableCard<T extends { id: string }>({
  icon,
  title,
  renderItem,
  items,
  itemWidth = 72,
  getExpandedHeight = (itemWidth) => (itemWidth / CARD_ASPECT_RATIO) * 3 + 24,
  containerClassNames,
  className,
  expandable = true,
  ...cardProps
}: ExpandableCardProps<T>) {
  const [isOpen, setIsOpenState] = useState(false)
  // Non-expandable sections never open — SectionHeader already hides the toggle affordance
  // when `expandable` is false, but guarding the setter too means isOpen can't get stuck
  // true if `expandable` flips off after the card was already open.
  const setIsOpen = expandable ? setIsOpenState : () => {}

  // Collapsed height is measured from the actual rendered items (max seen, so one short skeleton
  // item can't under-size the rail) rather than hand-computed — a hand-computed formula caused
  // real bugs before (clipped text, wrong aspect-ratio assumptions). Falls back to the card-
  // aspect-ratio estimate until the first measurement lands, to avoid a zero-height flash.
  const [measuredItemHeight, setMeasuredItemHeight] = useState<number | null>(null)
  const fallbackItemHeight = itemWidth / CARD_ASPECT_RATIO + 24
  const minItemHeight = measuredItemHeight ?? fallbackItemHeight
  const expandedItemHeight = getExpandedHeight(itemWidth)

  const handleItemLayout = useCallback((e: LayoutChangeEvent) => {
    const height = Math.ceil(e.nativeEvent.layout.height) + ROW_VERTICAL_PADDING
    setMeasuredItemHeight((prev) => (prev != null && prev >= height ? prev : height))
  }, [])

  return (
    <View className={cn('overflow-hidden px-0', className)} {...cardProps}>
      <SectionHeader
        icon={icon}
        title={title}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        expandable={expandable}
      />
      <MaskedView
        className={cn('z-0 overflow-visible min-w-max')}
        style={{
          height: isOpen ? expandedItemHeight : minItemHeight,
          maxWidth: '100%',
          overflow: 'visible',
        }}
        maskElement={
          <LinearGradient
            // MaskedView uses the alpha channel: solid shows content, transparent hides it.
            colors={['transparent', 'black', 'black', 'transparent']}
            start={isOpen ? { x: 0.5, y: 0.0 } : { x: 0.0, y: 0.5 }}
            end={isOpen ? { x: 0.5, y: 1 } : { x: 1, y: 0.5 }}
            locations={[0, 0.025, 0.9, 1]}
            style={{
              position: 'relative',
              height: '100%',
              width: '100%',
              top: '-2.5%',
              left: '-0%',
            }}
          />
        }
      >
        <ScrollView
          horizontal={!isOpen}
          decelerationRate="fast"
          snapToInterval={itemWidth}
          snapToAlignment="start"
          className="overflow-visible"
        >
          <View
            className={cn(
              'gap-x-2.5 gap-y-4 p-4 flex',
              {
                'flex-col': isOpen,
                'flex-row': !isOpen,
              },
              containerClassNames
            )}
          >
            {items.map((item, i) => {
              const ItemComponent = ({ item, isOpen }: { item: T; isOpen?: boolean }) =>
                renderItem({ item, isOpen }, i)
              return (
                <View
                  key={`${item?.id}-${i}`}
                  // flex-start, not the row's default stretch: without this, each wrapper is
                  // stretched to the row's *current* height before onLayout fires, so it always
                  // reports the (already-inflated) container height back — which grows the
                  // container again next render, forever. Pinning to natural content size
                  // breaks that feedback loop.
                  style={!isOpen ? { alignSelf: 'flex-start' } : undefined}
                  onLayout={!isOpen ? handleItemLayout : undefined}
                >
                  <ItemComponent item={item} isOpen={isOpen} />
                </View>
              )
            })}
          </View>
        </ScrollView>
      </MaskedView>
    </View>
  )
}
