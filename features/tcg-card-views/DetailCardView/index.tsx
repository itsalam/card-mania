import { useCardQuery } from '@/client/card'
import { useImageProxy } from '@/client/image-proxy'
import { BlurBackground, BlurGradientBackground, GradientBackground } from '@/components/Background'
import FullPriceGraph from '@/components/graphs/PriceGraph'
import { GraphInputKey } from '@/components/graphs/ui/types'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { useInvalidateOnFocus } from '@/components/tcg-card/helpers'
import { Text } from '@/components/ui/text/base-text'
import { chunk, formatLabel, formatPrice } from '@/components/utils'
import { qk } from '@/lib/store/functions/helpers'
import { Image } from 'expo-image'
import { Href } from 'expo-router'
import { Eye, EyeOff, Undo2, X } from 'lucide-react-native'
import React, { ReactNode, useCallback, useMemo, useState } from 'react'
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Colors, Dialog, PanningProvider } from 'react-native-ui-lib'

import { useViewSingleCollectionItem } from '@/client/collections/query'
import { useMeasure } from '@/components/hooks/useMeasure'
import { useCollaspableHeader } from '@/features/collection/ui'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { GestureDetector } from 'react-native-gesture-handler'
import { getCardDisplayData } from '../helpers'
import { DisplayData } from '../types'
import { CardScreenHeader } from './components/CardScreenHeader'
import { CollectionInfoCard } from './components/CollectionInfoCard'
import { Prices } from './components/Prices'
import { Footer } from './footer/footer'
import { AddToCollectionsView } from './footer/pages/add-to-collections'
import { CreateCollectionView } from './footer/pages/create-collection'
import { Coordinates, useSelectedGrades, useTransitionAnimation } from './helpers'
import { CardDetailsProvider } from './provider'

const CARD_WIDTH_RATIO = 0.65
const { width: W, height: H } = Dimensions.get('window')

const AImage = Animated.createAnimatedComponent(Image)

export default function FocusCardView({
  cardId,
  collectionIdArgs,
  animateFrom,
  returnTo,
}: {
  cardId: string
  collectionIdArgs?: { collectionId: string; itemId: string }
  animateFrom: { x: number; y: number; width: number; height: number }
  returnTo?: Href
}) {
  const { data: cardData } = useCardQuery(cardId)
  const { data: collectionItem } = useViewSingleCollectionItem(collectionIdArgs?.itemId)
  const displayData = useMemo(
    () => getCardDisplayData({ card: cardData, collectionItem }),
    [cardData, collectionItem]
  )

  const grades = cardData?.grades_prices ?? {}
  const prices = useMemo(
    () => Object.entries(grades || {}).sort((a, b) => b[0].localeCompare(a[0])),
    [grades]
  )

  const [showMoreGrades, setShowMoreGrades] = useState(false)
  const [visibleGrades, setVisibleGrades] = useState<string[]>(
    prices.filter(([, value]) => !!value).map(([key]) => key)
  )

  const { selectedGrades, setSelectedGrades, priceChartingData } = useSelectedGrades(
    cardData,
    visibleGrades
  )

  useInvalidateOnFocus(qk.recent)

  return (
    <CardDetailsProvider
      card={cardData}
      footerPages={[
        { title: 'Add to Collection', page: AddToCollectionsView },
        { title: 'Create Collection', page: CreateCollectionView },
      ]}
    >
      <CardDetailContainer
        animateFrom={animateFrom}
        returnTo={returnTo}
        cardId={cardId}
        displayData={displayData}
        title={
          <View
            className="p-4 flex flex-col gap-4 pb-8"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View className="p-4 flex flex-col items-start justify-stretch gap-1 w-full pb-0">
              <Text variant="h1" style={{ textAlign: 'left' }}>
                {cardData?.name}
              </Text>
              <Text
                className="font-spaceMono font-bold text-left"
                variant="h3"
                style={{
                  textAlign: 'left',
                  color: Colors.$textNeutral,
                }}
              >
                {cardData?.set_name}
              </Text>
            </View>
            {collectionIdArgs && (
              <CollectionInfoCard collectionItemId={collectionIdArgs.itemId} cardId={cardId} />
            )}
          </View>
        }
      >
        <View className="flex flex-col items-start justify-stretch gap-2 w-full">
          <CardScreenHeader title={'Prices'} />
          <Prices
            prices={prices}
            visibleGrades={visibleGrades}
            setSelectedGrades={setSelectedGrades}
            setShowMoreGrades={setShowMoreGrades}
            selectedGrades={selectedGrades}
          />

          <FullPriceGraph<Record<string, string | number>>
            xKey={'date' as GraphInputKey<typeof priceChartingData>}
            yKeys={selectedGrades}
            data={priceChartingData?.priceData}
          />
        </View>

        <View className="pt-4 flex flex-col items-start justify-stretch gap-2 w-full">
          <CardScreenHeader title={'Offers'} />
        </View>
      </CardDetailContainer>

      <Dialog
        visible={showMoreGrades}
        overlayBackgroundColor={Colors.rgba(Colors.grey10, 0.8)}
        panDirection={PanningProvider.Directions.DOWN}
        useSafeArea
        bottom
        centerH
      >
        <FlatList
          style={{ overflow: 'visible' }}
          showsVerticalScrollIndicator={false}
          keyExtractor={(row) => row.map((r) => r?.[0][0] ?? 'back-button-row').join('|')}
          renderItem={({ item }) => {
            if (item[0] === null) {
              return (
                <Button
                  fullWidth
                  size="medium"
                  round
                  style={{ height: 60, borderRadius: 12 }}
                  className="my-1 items-center justify-center flex flex-row"
                  onPress={() => setShowMoreGrades(false)}
                >
                  <Text className="text-3xl capitalize text-nowrap text-right">Back</Text>
                  <View style={{ position: 'absolute', right: 20 }}>
                    <Undo2 size={28} />
                  </View>
                </Button>
              )
            }
            return (
              <View className="flex flex-row gap-1">
                {(item as [string, number | null][]).map(([key, value]) => (
                  <LiquidGlassCard
                    size="sm"
                    className="w-full h-10 my-1.5 relative flex items-center justify-center flex-1"
                    onPress={() => {
                      setVisibleGrades((prev) =>
                        prev.includes(key) ? prev.filter((grade) => grade !== key) : [...prev, key]
                      )
                    }}
                    key={`${key}-${value}`}
                  >
                    <View className="flex flex-row gap-2 items-center justify-end">
                      <Text className="text-lg font-bold text-muted-foreground text-nowrap text-right font-spaceMono">
                        {formatLabel(key)}
                      </Text>
                    </View>
                    <Text className="text-3xl capitalize text-nowrap text-right">
                      {value ? formatPrice(value) : '--'}
                    </Text>
                    <View style={{ position: 'absolute', right: 20 }}>
                      {visibleGrades.includes(key) ? <Eye size={28} /> : <EyeOff size={28} />}
                    </View>
                  </LiquidGlassCard>
                ))}
              </View>
            )
          }}
          data={chunk([...prices, null, null], 2) as ([string, number | null] | null)[][]}
        />
      </Dialog>
      <Footer card={cardData} />
    </CardDetailsProvider>
  )
}

const AMaskedView = Animated.createAnimatedComponent(MaskedView)

const CardDetailContainer = ({
  children,
  displayData,
  animateFrom,
  cardId,
  title,
  returnTo,
}: {
  cardId: string
  displayData: DisplayData | null
  animateFrom: Coordinates
  children: ReactNode
  title: ReactNode
  returnTo?: Href
}) => {
  const {
    ref: imageContainerLayoutRef,
    layout: imageContainerLayout,
    onLayout: onImageContainerLayout,
  } = useMeasure<View>()

  const adjustedAnimateFrom = useMemo(
    () =>
      imageContainerLayout
        ? {
            ...animateFrom,
            x: animateFrom.x - imageContainerLayout.x,
            y: animateFrom.y - imageContainerLayout.y,
          }
        : animateFrom,
    [animateFrom, imageContainerLayout]
  )

  const insets = useSafeAreaInsets()
  const {
    progress,
    cardStyle: cardTransition,
    scrimStyle,
    close,
  } = useTransitionAnimation(animateFrom, {
    fallbackHref: returnTo,
    animateTo: {
      width: W * CARD_WIDTH_RATIO,
      height: (W * CARD_WIDTH_RATIO) / (5 / 7),
      x: (W * (1 - CARD_WIDTH_RATIO)) / 2,
      y: insets.top + 68,
    },
    ready: !!imageContainerLayout,
  })
  const CARD_TITLE_POSITION = 1.0

  const y = useSharedValue(0)

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y
    y.set(offsetY)
  }, [])
  const travelDistance = CARD_TITLE_POSITION * ((W * 7) / 5)
  const scrollProgress = useDerivedValue(() => Math.max(0, y.value / travelDistance))

  const backgroundOpacity = useSharedValue([1, 0])
  useAnimatedReaction(
    () => interpolate(scrollProgress.value, [0, 1], [0, 0.8], Extrapolation.CLAMP),
    (next) => {
      backgroundOpacity.value = [1, withDelay(500, withTiming(next, { duration: 300 }))]
    }
  )

  const titleOpacity = useSharedValue([0, 1, 0.9, 0])
  useAnimatedReaction(
    () => interpolate(scrollProgress.value, [0.8, 1.0], [0, 0.8], Extrapolation.CLAMP),
    (next) => {
      titleOpacity.value = [withDelay(500, withTiming(next, { duration: 300 })), 1, 0.9, 0]
    }
  )

  const { data: image } = useImageProxy({
    variant: 'detail',
    shape: 'card',

    cardId: cardId,
    imageType: 'front',
    quality: 100,
    ...displayData?.imageProxyArgs,
  })

  const { data: thumbnailImage } = useImageProxy({
    variant: 'tiny',
    shape: 'card',
    cardId: cardId,
    imageType: 'front',
    queryHash: displayData?.imageProxyArgs?.queryHash ?? undefined,
  })

  const {
    expandProgress,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
    measuredHeaderHeight,
  } = useCollaspableHeader()

  const headerAStyle = useAnimatedStyle(() => ({
    height:
      measuredHeaderHeight.value > 0
        ? interpolate(
            expandProgress.value,
            [0, 1],
            [measuredHeaderHeight.value, measuredHeaderHeight.value * 0.4]
          )
        : 'auto',
  }))

  const cardImageAnimStyle = useAnimatedStyle(() => ({
    width: interpolate(
      expandProgress.value,
      [0, 1],
      [W * CARD_WIDTH_RATIO, W],
      Extrapolation.CLAMP
    ),
    top: interpolate(expandProgress.value, [0, 1], [insets.top + 68, 0], Extrapolation.CLAMP),
    left: interpolate(
      expandProgress.value,
      [0, 1],
      [(W * (1 - CARD_WIDTH_RATIO)) / 2, 0],
      Extrapolation.CLAMP
    ),
    opacity: interpolate(expandProgress.value, [0, 0.1], [1, 0.4], Extrapolation.CLAMP),
    borderRadius: interpolate(expandProgress.value, [0, 0.1], [10, 0], Extrapolation.CLAMP),
  }))

  return (
    <GestureDetector gesture={composedGestures}>
      <Animated.View
        style={[
          {
            width: W,
            height: H,
          },
        ]}
      >
        <View>
          <AMaskedView
            style={[
              {
                overflow: 'visible',
                position: 'relative',
                width: '100%',
                // backgroundColor: 'red',
              },
              // headerAnimatedStyle,
              headerAStyle,
            ]}
            maskElement={
              <LinearGradient
                // MaskedView uses the alpha channel: solid shows content, transparent hides it.
                colors={['#FFFFFFA5', 'black', 'black', '#FFFFFF35']}
                start={{ y: 0.0, x: 0.5 }}
                end={{ y: 1, x: 0.5 }}
                locations={[0, 0.15, 0.85, 1]}
                style={{
                  position: 'absolute',
                  height: '100%',
                  width: '100%',
                  // top: '-2.5%',
                  left: '-0%',
                }}
              />
            }
          >
            <View
              onLayout={onHeaderLayout}
              style={[
                {
                  width: '100%',
                  aspectRatio: 5 / 6,
                },
              ]}
            >
              <Animated.View
                style={[
                  cardTransition,
                  cardImageAnimStyle,
                  {
                    aspectRatio: 5 / 7,
                  },
                ]}
                ref={imageContainerLayoutRef}
                onLayout={onImageContainerLayout}
              >
                <View
                  style={{
                    width: '106.3%',
                    height: '106.8%',
                    position: 'absolute',
                    top: '-3.15%',
                    left: '-3.4%',
                    borderColor: 'rgba(80,80,80,1)',
                    borderWidth: 1,
                  }}
                >
                  <LinearGradient
                    colors={[
                      'rgba(80,80,80,0.7)',
                      'transparent',
                      'transparent',
                      'rgba(80,80,80,0.7)',
                    ]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    locations={[0, 0.1, 0.9, 1]}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                  />
                  <LinearGradient
                    colors={[
                      'rgba(80,80,80,0.7)',
                      'transparent',
                      'transparent',
                      'rgba(80,80,80,0.7)',
                    ]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    locations={[0, 0.1, 0.9, 1]}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                  />
                </View>
                <AImage
                  style={[
                    {
                      width: '100%',
                      height: '100%',
                      borderRadius: 6,
                    },
                  ]}
                  source={[
                    {
                      uri: image,
                      cacheKey: `${displayData?.imageProxyArgs.imageId || displayData?.imageProxyArgs.cardId}-thumb`,
                      width: W * CARD_WIDTH_RATIO,
                      height: (W * CARD_WIDTH_RATIO) / (5 / 7),
                    },
                  ]}
                  placeholder={
                    thumbnailImage
                      ? {
                          uri: thumbnailImage,
                          cacheKey: `${cardId}-thumb`,
                          width: W,
                          height: W / (5 / 7),
                        }
                      : undefined
                  }
                  placeholderContentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                  contentFit="cover"
                />
              </Animated.View>
            </View>
          </AMaskedView>
        </View>
        <GradientBackground
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 0.0 }}
          colors={[Colors.$backgroundDefault, 'transparent']}
          positions={[0.5, 1.0]}
          opacity={[1, 0]}
          style={{
            zIndex: 2,
            flex: 0,
            width: '100%',
            marginTop: -100,
          }}
        >
          {title}
        </GradientBackground>
        <Button
          onPress={close}
          style={{ position: 'absolute', left: 16, top: insets.top + 16, zIndex: 20 }}
        >
          <X size={20} />
        </Button>
        <BlurBackground />
        <BlurGradientBackground
          backgroundOpacity={backgroundOpacity}
          start={{ x: 0.5, y: 1.0 }}
          end={{ x: 0.5, y: 0.0 }}
          colors={[Colors.$backgroundDefault, Colors.$backgroundDefault]}
          positions={[0.2, 0.6]}
          opacity={progress}
          style={[
            StyleSheet.absoluteFill,
            { zIndex: -1, backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.95) },
          ]}
        />

        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16} // ~60fps updates
          // style={[{ paddingBottom: insets.bottom + 20, transform: [{ translateY: '-50%' }] }]}
          // contentContainerStyle={[{ paddingTop: travelDistance, paddingBottom: travelDistance }]}
          stickyHeaderIndices={[1]}
          ref={scrollViewRef}
          onLayout={onListLayout}
          onContentSizeChange={onContentSizeChange}
          style={{
            width: W,
            flex: 1,
          }}
        >
          <Animated.View style={[{ position: 'relative' }, scrimStyle]}>
            <View>{children}</View>
          </Animated.View>
        </Animated.ScrollView>
      </Animated.View>
    </GestureDetector>
  )
}
