import { CollectionLike } from '@/client/collections/types'
import { useCloneMeasure } from '@/components/hooks/useCloneMeasure'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { useRegisterGestureBlocker } from '@/features/collection/ui'
import { ChevronDown } from 'lucide-react-native'
import { ComponentProps, useEffect, useState } from 'react'
import { useWindowDimensions, View, ViewProps } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { BorderRadiuses, Colors, TouchableOpacity } from 'react-native-ui-lib'
import { useUserStorefront } from '../client'
import { StorefrontView } from '../components/storefront-view'
import { useUserProfilePage } from '../providers'

const BORDER_WIDTH = 3

export function StorefrontPage() {
  const profile = useUserProfilePage((s) => s.user)
  const { data: collections } = useUserStorefront(profile?.user_id)
  const [activeCollection, setActiveCollection] = useState(collections?.[0])

  useEffect(() => {
    if (!Boolean(activeCollection) && collections?.length) {
      setActiveCollection(collections[0])
    }
  }, [activeCollection, collections])

  return (
    <View>
      <View style={{ padding: 12 }}>
        <StoreFrontDropdown
          collections={collections}
          activeCollection={activeCollection}
          onSelect={(selectedId) =>
            setActiveCollection(collections?.find((collection) => collection.id === selectedId))
          }
        />
      </View>
      <StorefrontView collectionId={activeCollection?.id} />
    </View>
  )
}
const ATouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity)
function DropdownContainer({
  collection,
  children,
  index,
  style,
  selected,
  ...props
}: {
  collection?: CollectionLike
  index?: number
  selected?: boolean
} & ComponentProps<typeof ATouchableOpacity>) {
  return (
    <ATouchableOpacity
      style={[
        {
          borderRadius: BorderRadiuses.br50,
          borderWidth: index !== undefined ? 0 : BORDER_WIDTH,
          // margin: index !== undefined ? 3 : 0,
          borderColor: Colors.$outlineNeutral,
          backgroundColor: selected ? Colors.$backgroundElevatedLight : Colors.$backgroundElevated,
          padding: selected ? 8 : 12,
          paddingHorizontal: selected ? 16 : 20,
          margin: selected ? 4 : 0,
        },
        style,
      ]}
      {...props}
    >
      <View>
        <Text ellipsizeMode="tail" numberOfLines={1} variant={'h3'}>
          {collection?.name}
        </Text>
        <Text variant={'default'} style={{ fontSize: 16 }} ellipsizeMode="tail" numberOfLines={1}>
          {collection?.description}
        </Text>
      </View>
      {children}
    </ATouchableOpacity>
  )
}

function StoreFrontDropdown({
  collections,
  activeCollection,
  onSelect,
}: {
  collections?: CollectionLike[]
  activeCollection?: CollectionLike
  onSelect?: (collectionId: string) => void
}) {
  const MAX_DROPDOWN_HEIGHT = 400
  const [focus, setFocus] = useState(false)

  const measuredButtonHeight = useSharedValue(0)
  const measuredDropDownHeight = useSharedValue(0)
  const currDropdownHeightSV = useSharedValue(0)
  const spinSV = useSharedValue(0)
  const startColor = useSharedValue(Colors.$backgroundElevated)
  const endColor = useSharedValue(Colors.$backgroundDefault)
  const backgroundColourSV = useSharedValue(0)
  const { height: screenHeight } = useWindowDimensions()

  const blocker = Gesture.Native()

  useRegisterGestureBlocker(blocker)

  const DropdownItemContainers = (props: ViewProps) => (
    <View
      style={{
        flex: 1,
      }}
      {...props}
    >
      <DropdownContainer
        collection={activeCollection}
        style={{
          opacity: 0,
        }}
      />

      {collections &&
        collections.map((collection, index) => (
          <View key={collection.id}>
            <DropdownContainer
              key={collection.id}
              collection={collection}
              index={index + 1}
              selected={collection.id === activeCollection?.id}
              onPress={() => {
                if (collection.id) {
                  onSelect?.(collection.id)
                  setTimeout(() => setFocus(false), 150)
                }
              }}
            />
            {collections?.length !== index + 1 && (
              <View style={{ marginHorizontal: 14 }}>
                <Separator
                  style={{ height: 3, borderRadius: 999, opacity: 0.5 }}
                  orientation="horizontal"
                />
              </View>
            )}
          </View>
        ))}
    </View>
  )

  const { layout, Clone } = useCloneMeasure(<DropdownItemContainers />, {
    removeAfterMeasure: true,
    deps: [collections],
  })

  useEffect(() => {
    if (layout) {
      measuredDropDownHeight.value = Math.min(layout.height, screenHeight / 3, MAX_DROPDOWN_HEIGHT)
    }
  }, [layout])

  useAnimatedReaction(
    () => ({
      focus,
      h: measuredDropDownHeight.value,
      b: measuredButtonHeight.value,
    }),
    ({ focus, h, b }) => {
      const target = focus ? h : b
      currDropdownHeightSV.value = withTiming(target, { duration: 180 })
      backgroundColourSV.value = withTiming(focus ? 1 : 0, { duration: 180 })

      // Conditional delay: Delay only when opening
      const rotationAnimation = withTiming(focus ? 1 : 0, { duration: 90 })
      spinSV.value = focus ? withDelay(100, rotationAnimation) : rotationAnimation
    },
    [focus]
  )

  const dropdownStyle = useAnimatedStyle(
    () => ({ height: currDropdownHeightSV.value }),
    [currDropdownHeightSV, measuredButtonHeight]
  )

  const buttonStyle = useAnimatedStyle(
    () => ({
      backgroundColor: interpolateColor(spinSV.value, [0, 1], [startColor.value, endColor.value]),
    }),
    [spinSV]
  )

  const arrowStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          rotate: `${interpolate(spinSV.value, [0, 1], [0, 90])}deg`,
        },
      ],
    }),
    [spinSV]
  )

  return (
    <View
      style={{
        position: 'relative',

        zIndex: 100,
      }}
    >
      <Animated.View
        style={{
          height: measuredButtonHeight.value,
        }}
      />
      <DropdownContainer
        collection={activeCollection}
        style={[
          {
            position: 'absolute',
            width: '100%',
            zIndex: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          buttonStyle,
        ]}
        onPress={() => setFocus((focus) => !focus)}
        onLayout={(e) => {
          measuredButtonHeight.value = e.nativeEvent.layout.height
        }}
      >
        <Animated.View style={[arrowStyle, { margin: 6 }]}>
          <ChevronDown color={Colors.$iconDefault} />
        </Animated.View>
      </DropdownContainer>
      <GestureDetector gesture={blocker}>
        <Animated.ScrollView
          style={[
            {
              zIndex: 10,
              position: 'absolute',
              top: 0,
              borderRadius: BorderRadiuses.br50,
              borderWidth: BORDER_WIDTH,
              borderColor: Colors.$outlineNeutral,
              backgroundColor: Colors.$backgroundNeutralLight,
              width: '100%',
              maxHeight: Math.min(screenHeight / 3, MAX_DROPDOWN_HEIGHT),
            },

            dropdownStyle,
          ]}
        >
          {Clone}
          <DropdownItemContainers />
        </Animated.ScrollView>
      </GestureDetector>
    </View>
  )
}
