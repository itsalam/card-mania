import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react-native'
import React, { ComponentProps, useState } from 'react'
import { ScrollView } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { CARD_ASPECT_RATIO } from '../consts'
import { Box } from '../ui/box'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Heading } from '../ui/heading'
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
    <VStack className="flex-1">
      <Heading size="lg">{'Placeholder box.'}</Heading>
      <Text>You can replace this with any content you like, such as a card or an image.</Text>
    </VStack>
  )
}

type ExpandableCardProps<T extends object> = {
  title: string
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
  ...cardProps
}: ExpandableCardProps<T>) {
  const [isOpen, setIsOpen] = useState(false)

  const minItemHeight = itemWidth / CARD_ASPECT_RATIO
  const expandedItemHeight = getExpandedHeight(itemWidth)

  return (
    <Card
      size="md"
      variant='outline'
      className="overflow-hidden p-2"
      {...cardProps}
      style={{
        backgroundColor: Colors.$backgroundElevated,
        borderColor: Colors.$outlineNeutral,
        borderWidth: 1,
      }}
    >
      <Button
        variant="ghost"
        onPress={() => setIsOpen(!isOpen)}
        className="h-auto w-full px-8 py-6 z-button"
      >
        <Box className="w-full items-center justify-between flex flex-row p-1">
          <Heading size="2xl">{title}</Heading>
          <Icon style={{ transform: [{ rotate: !isOpen ? '-90deg' : '0deg' }] }} as={ChevronDown} />
        </Box>
      </Button>
      <VStack className="max-w-full overflow-hidden pr-4 mask-r-from-30% pb-4">
        <VStack
          className={cn('z-0 overflow-visible min-w-max')}
          style={{
            height: isOpen ? expandedItemHeight : minItemHeight,
          }}
        >
          <ScrollView
            horizontal={!isOpen}
            decelerationRate="fast"
            snapToInterval={DEFAULT_CARD_WIDTH} // snap like a carousel
            snapToAlignment="start"
            disableIntervalMomentum
            className="overflow-visible"
          >
            <HStack
              className={cn(
                'gap-x-2.5 gap-y-4 px-4 flex',
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
                return <ItemComponent key={item.item_id} item={item} isOpen={isOpen} />
              })}
            </HStack>
          </ScrollView>
        </VStack>
      </VStack>
    </Card>
  )
}
