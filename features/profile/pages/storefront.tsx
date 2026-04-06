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

const BORDER_WIDTH = 1

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
      <View style={{ padding: 8 }}>
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
          borderColor: Colors.$outlineNeutral,
          backgroundColor: selected ? Colors.$backgroundElevatedLight : Colors.$backgroundElevated,
          padding: selected ? 12 : 12,
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
      </View>
      {children}
    </ATouchableOpacity>
  )
}

function DropdownItemContainers({
  activeCollection,
  collections,
  onSelect,
  setFocus,
  ...props
}: ViewProps & {
  activeCollection?: CollectionLike
  collections?: CollectionLike[]
  onSelect?: (id: string) => void
  setFocus?: (v: boolean) => void
}) {
  return (
    <View style={{ flex: 1, paddingVertical: 2 }} {...props}>
      <DropdownContainer collection={activeCollection} style={{ opacity: 0, marginBottom: 4 }} />
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
                  setTimeout(() => setFocus?.(false), 150)
                }
              }}
              style={{
                margin: 4,
                borderRadius: BorderRadiuses.br30,
              }}
            />
            {collections?.length !== index + 1 && (
              <View style={{ marginHorizontal: 14 }}>
                <Separator
                  style={{ height: 2, borderRadius: 999, opacity: 0.5 }}
                  orientation="horizontal"
                />
              </View>
            )}
          </View>
        ))}
    </View>
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
  const { height: screenHeight } = useWindowDimensions()

  const blocker = Gesture.Native()

  useRegisterGestureBlocker(blocker)

  const { layout, Clone } = useCloneMeasure(
    <DropdownItemContainers
      activeCollection={activeCollection}
      collections={collections}
      onSelect={onSelect}
      setFocus={setFocus}
    />,
    {
      removeAfterMeasure: true,
      deps: [collections],
    }
  )

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

      const rotationAnimation = withTiming(focus ? 1 : 0, { duration: 90 })
      spinSV.value = focus ? withDelay(100, rotationAnimation) : rotationAnimation
    },
    [focus]
  )

  const dropdownStyle = useAnimatedStyle(
    () => ({ height: currDropdownHeightSV.value }),
    [currDropdownHeightSV, measuredButtonHeight]
  )

  const bgElevated = Colors.$backgroundElevated as string
  const bgDefault = Colors.$backgroundDefault as string

  const buttonStyle = useAnimatedStyle(
    () => ({
      backgroundColor: interpolateColor(spinSV.value, [0, 1], [bgElevated, bgDefault]),
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
    <View style={{ position: 'relative', zIndex: 100 }}>
      {Clone}
      <Animated.View style={{ height: measuredButtonHeight }} />
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
          <DropdownItemContainers
            activeCollection={activeCollection}
            collections={collections}
            onSelect={onSelect}
            setFocus={setFocus}
          />
        </Animated.ScrollView>
      </GestureDetector>
    </View>
  )
}
