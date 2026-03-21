import { THUMBNAIL_WIDTH } from '@/components/tcg-card/consts'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { debounce } from 'lodash'
import { useState } from 'react'
import { Dimensions, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { ItemListView } from './ListCard'
import { DisplayData, GalleryListingProps } from './types'

const ITEM_SEPARATOR = 24
const ITEM_STRIDE = THUMBNAIL_WIDTH + ITEM_SEPARATOR
const { width: SCREEN_WIDTH } = Dimensions.get('window')

export function AnimatedGalleryItem({
  item,
  index,
  scrollX,
  renderAccessories,
  onPress,
  isCurrent,
}: {
  item: DisplayData
  index: number
  scrollX: SharedValue<number>
  renderAccessories?: GalleryListingProps['renderItemAccessories']
  onPress?: () => void
  isCurrent?: boolean
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const itemCenter = index * ITEM_STRIDE + THUMBNAIL_WIDTH / 2
    const viewportCenter = scrollX.value + THUMBNAIL_WIDTH / 2
    const distance = Math.abs(itemCenter - viewportCenter)
    const scale = interpolate(distance, [0, ITEM_STRIDE], [1, 0.85], Extrapolation.CLAMP)
    return { transform: [{ scale }] }
  })

  return (
    <Animated.View style={animatedStyle}>
      <ItemListView
        vertical
        displayData={item}
        renderAccessories={renderAccessories?.(Boolean(isCurrent))}
        onPress={onPress}
      />
    </Animated.View>
  )
}

function Titles(props: GalleryListingProps) {
  const { isLoading, displayData } = props
  return (
    <View
      className="flex flex-col h-full w-full items-start p-4 pr-0 flex-1 pt-2"
      // style={{ backgroundColor: 'red' }}
    >
      {isLoading ? (
        <View>
          <Skeleton style={{ height: 32, width: 190, marginBottom: 6 }} />
          <Skeleton style={{ height: 14, width: 275, marginBottom: 4 }} />
        </View>
      ) : (
        <>
          <Text
            variant={'h2'}
            className="font-bold text-wrap leading-none"
            style={{
              color: Colors.$textDefault,
            }}
          >
            {displayData?.title}
          </Text>
          <Text
            variant={'muted'}
            className="text-base capitalize"
            style={{
              color: Colors.$textNeutral,
            }}
          >
            {displayData?.subHeading}
          </Text>
        </>
      )}
    </View>
  )
}

export function GalleryCard(props: GalleryListingProps) {
  const { displayDataArr, renderItemAccessories: renderImageAccessories } = props
  const flatListRef = useAnimatedRef<Animated.FlatList<DisplayData>>()
  const scrollX = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x
  })

  const [isCurrent, setIsCurrent] = useState(0)
  const debounceSetIsCurrent = debounce(setIsCurrent, 350, { trailing: true })
  const currentIndex = useDerivedValue(() => Math.round(scrollX.value / ITEM_STRIDE))
  useAnimatedReaction(
    () => currentIndex.value,
    (curr, prev) => {
      if (curr !== prev) scheduleOnRN(debounceSetIsCurrent, curr)
    }
  )

  const scrollToIndex = (index: number) => {
    flatListRef.current?.scrollToOffset({ offset: index * ITEM_STRIDE, animated: true })
    setIsCurrent(index)
  }

  return (
    <View className="py-2" style={{}}>
      <View
        className="flex flex-row justify-between items-center"
        style={{
          padding: 20,
          paddingBottom: 0,
        }}
      >
        <Titles {...props} />
      </View>

      <MaskedView
        style={{ overflow: 'visible' }}
        maskElement={
          <LinearGradient
            colors={['transparent', 'black', 'black', 'transparent']}
            locations={[0, 0.08, 0.92, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        }
      >
        <Animated.FlatList
          ref={flatListRef}
          horizontal
          data={displayDataArr}
          keyExtractor={(item) => item.id}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingEnd: SCREEN_WIDTH - THUMBNAIL_WIDTH - 20,
            paddingStart: 20,
          }}
          renderItem={({ item, index }) => (
            <AnimatedGalleryItem
              item={item}
              index={index}
              scrollX={scrollX}
              renderAccessories={renderImageAccessories}
              onPress={() => scrollToIndex(index)}
              isCurrent={isCurrent === index}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ paddingHorizontal: 12 }} />}
        />
      </MaskedView>

      <View></View>
    </View>
  )
}
