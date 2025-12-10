import { cn } from '@/lib/utils'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronDown } from 'lucide-react-native'
import React, { ComponentProps, ReactNode, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { CARD_ASPECT_RATIO } from '../consts'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { HStack } from '../ui/hstack'
import { Icon } from '../ui/icon'
import { Text } from '../ui/text'
import { VStack } from '../ui/vstack'

const DEFAULT_CARD_WIDTH = 72
const ITEM_ASPECT_RATIO = 5 / 7

export function PlaceholderBox({
  isOpen = false,
  className,
  ...props
}: ComponentProps<typeof VStack> & { isOpen?: boolean }) {
  return (
    <HStack className={cn('gap-6 flex', isOpen && 'min-w-full')}>
      <VStack {...props} className={cn(className, 'rounded-lg')} />
      {isOpen && <ExpandedContent />}
    </HStack>
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

type ExpandableCardProps<T extends object> = {
  title: ReactNode
  items: T[]
  renderItem: ({ item, isOpen }: { item: T; isOpen?: boolean }, index: number) => React.ReactNode
  itemWidth?: number
  getExpandedHeight?: (itemWidth: number) => number
  containerClassNames?: string
} & ComponentProps<typeof Card>

export function ExpandableCard<T extends object>({
  title,
  renderItem,
  items,
  itemWidth = DEFAULT_CARD_WIDTH,
  getExpandedHeight = (itemWidth) => (itemWidth / CARD_ASPECT_RATIO) * 3 + 24,
  containerClassNames,
  className,
  ...cardProps
}: ExpandableCardProps<T>) {
  const [isOpen, setIsOpen] = useState(false)

  const minItemHeight = itemWidth / CARD_ASPECT_RATIO + 24
  const expandedItemHeight = getExpandedHeight(itemWidth)

  return (
    <Card size="md" className={cn('overflow-hidden px-0', className)} {...cardProps}>
      <Button
        variant="ghost"
        onPress={() => setIsOpen(!isOpen)}
        className="h-auto w-full py-6 z-button"
      >
        <View className="w-full items-center flex flex-row p-1 gap-2 px-4">
          <Text>{title}</Text>
          <Icon
            style={{ transform: [{ rotate: !isOpen ? '-90deg' : '0deg' }] }}
            as={ChevronDown}
            color={Colors.$iconDefault}
            size={24}
          />
        </View>
      </Button>
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
          snapToInterval={DEFAULT_CARD_WIDTH} // snap like a carousel
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
              return <ItemComponent key={item?.item_id} item={item} isOpen={isOpen} />
            })}
          </View>
        </ScrollView>
      </MaskedView>
    </Card>
  )
}
