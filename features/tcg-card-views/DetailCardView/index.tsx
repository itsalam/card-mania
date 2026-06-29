import { useCardQuery } from '@/client/card'
import { useImageProxy } from '@/client/image-proxy'
import { BlurBackground, BlurGradientBackground, GradientBackground } from '@/components/Background'
import { gradientColors } from '@/components/graphs/helpers'
import FullPriceGraph from '@/components/graphs/PriceGraph'
import { GraphInputKey } from '@/components/graphs/ui/types'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { useInvalidateOnFocus } from '@/components/tcg-card/helpers'
import { Text } from '@/components/ui/text/base-text'
import { chunk, formatLabel, formatPrice } from '@/components/utils'
import { qk } from '@/lib/store/functions/helpers'
import { Image } from 'expo-image'
import { Href } from 'expo-router'
import { ArrowLeft, Eye, EyeOff, Undo2 } from 'lucide-react-native'
import React, { ReactNode, useCallback, useMemo, useState } from 'react'
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Dialog, PanningProvider } from 'react-native-ui-lib'

import { useViewSingleCollectionItem } from '@/client/collections/query'
import { useMeasure } from '@/components/hooks/useMeasure'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCollaspableHeader } from '@/features/collection/ui'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { GestureDetector } from 'react-native-gesture-handler'
import { getCardDisplayData } from '../helpers'
import { PriceSummaryBar } from '../PriceSummaryBar'
import { RecentSalesList } from '../RecentSalesList'
import { DisplayData } from '../types'
import { CardScreenHeader } from './components/CardScreenHeader'
import { CollectionInfoCard } from './components/CollectionInfoCard'
import { Prices } from './components/Prices'
import { Footer } from './footer/footer'
import { AddToCollectionsView } from './footer/pages/add-to-collections'
import { CreateCollectionView } from './footer/pages/create-collection'
import { GradeColorsProvider } from './GradeColorsProvider'
import { Coordinates, useSelectedGrades, useTransitionAnimation } from './helpers'
import { CardDetailsProvider } from './provider'

function SalesListSkeleton() {
  const rowStyle = {
    flexDirection: 'row' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  }
  return (
    <View style={{ gap: 1 }}>
      <View style={rowStyle}>
        <Skeleton style={{ flex: 1.4, height: 10, borderRadius: 4 }} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} style={{ flex: 1, height: 10, borderRadius: 4 }} />
        ))}
      </View>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={rowStyle}>
          <Skeleton style={{ flex: 1.4, height: 13, borderRadius: 4 }} />
          {[0, 1, 2].map((j) => (
            <Skeleton key={j} style={{ flex: 1, height: 13, borderRadius: 4 }} />
          ))}
        </View>
      ))}
    </View>
  )
}

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
  console.log(cardData?.grades_prices)
  const grades = cardData?.grades_prices ?? {}
  const prices = useMemo(
    () => Object.entries(grades || {}).sort((a, b) => b[0].localeCompare(a[0])),
    [grades]
  )

  const [showMoreGrades, setShowMoreGrades] = useState(false)
  const [priceTab, setPriceTab] = useState<'chart' | 'sales'>('chart')

  // Animated toggle state
  const tabShared = useSharedValue(0) // 0 = chart, 1 = sales
  const pillInnerWidth = useSharedValue(0)
  const contentOpacity = useSharedValue(1)

  const slideIndicatorStyle = useAnimatedStyle(() => ({
    left: tabShared.value * (pillInnerWidth.value / 2),
    width: pillInnerWidth.value > 0 ? pillInnerWidth.value / 2 : 0,
  }))

  const contentFadeStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }))

  const handleTabPress = (tab: 'chart' | 'sales') => {
    if (tab === priceTab) return
    tabShared.value = withSpring(tab === 'chart' ? 0 : 1, {
      damping: 24,
      stiffness: 300,
      mass: 0.6,
    })
    contentOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setPriceTab)(tab)
      contentOpacity.value = withTiming(1, { duration: 200 })
    })
  }

  const [visibleGrades, setVisibleGrades] = useState<string[]>(
    prices.filter(([, value]) => !!value).map(([key]) => key)
  )

  const { selectedGrades, setSelectedGrades, priceChartingData, optimisticPriceData } =
    useSelectedGrades(cardData, visibleGrades)

  const mergedPriceData = useMemo(
    () => [...(priceChartingData?.priceData ?? []), ...(optimisticPriceData ?? [])],
    [priceChartingData?.priceData, optimisticPriceData]
  )

  const COLOR_RANGE: [string, string] = ['#34d399', '#818cf8']
  const gradeKeys = useMemo(() => prices.map(([k]) => k), [prices])
  const gradeColors = useMemo(() => {
    if (!gradeKeys.length) return {}
    const cs = gradientColors(COLOR_RANGE[0], COLOR_RANGE[1], gradeKeys.length)
    return Object.fromEntries(gradeKeys.map((g, i) => [g, cs[i]]))
  }, [gradeKeys])

  useInvalidateOnFocus(qk.recent)

  const footerPages = useMemo(
    () => [
      { title: 'Add to Collection', page: AddToCollectionsView },
      { title: 'Create Collection', page: CreateCollectionView },
    ],
    []
  )

  return (
    <CardDetailsProvider card={cardData} footerPages={footerPages}>
      <CardDetailContainer
        animateFrom={animateFrom}
        returnTo={returnTo}
        cardId={cardId}
        displayData={displayData}
        title={
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 6,
              paddingBottom: 12,
              gap: 6,
            }}
          >
            <View style={{ paddingHorizontal: 4, gap: 2 }}>
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
          </View>
        }
        sections={[
          ...(collectionIdArgs
            ? [
                {
                  header: (
                    <CollectionInfoCard
                      collectionItemId={collectionIdArgs.itemId}
                      cardId={cardId}
                    />
                  ),
                },
              ]
            : []),
          {
            header: <CardScreenHeader title={'Prices'} />,
            content: (
              <GradeColorsProvider grades={gradeKeys} colorRange={COLOR_RANGE}>
                <View className="flex flex-col items-start justify-stretch gap-2 w-full pb-12">
                  {/* KPI summary: Last Sale + 3M Range */}
                  {mergedPriceData.length > 0 && (
                    <View style={{ width: '100%', paddingHorizontal: 16 }}>
                      <PriceSummaryBar
                        priceData={mergedPriceData}
                        selectedGrades={selectedGrades}
                        gradeColors={gradeColors}
                      />
                    </View>
                  )}

                  <Prices
                    prices={prices}
                    visibleGrades={visibleGrades}
                    setSelectedGrades={setSelectedGrades}
                    setShowMoreGrades={setShowMoreGrades}
                    selectedGrades={selectedGrades}
                  />

                  {/* Chart / Sales segmented control */}
                  <View
                    onLayout={(e) => {
                      pillInnerWidth.value = e.nativeEvent.layout.width - 6
                    }}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
                      borderWidth: 1,
                      borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
                      borderRadius: 999,
                      padding: 3,
                      marginHorizontal: 16,
                      marginBottom: 4,
                    }}
                  >
                    {/* Sliding active indicator */}
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        slideIndicatorStyle,
                        {
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          borderRadius: 999,
                          backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35),
                        },
                      ]}
                    />
                    {(['chart', 'sales'] as const).map((t) => {
                      const active = priceTab === t
                      return (
                        <Pressable
                          key={t}
                          onPress={() => handleTabPress(t)}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            paddingVertical: 7,
                            borderRadius: 999,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: '700',
                              color: active ? Colors.$textDefault : Colors.$textNeutral,
                            }}
                          >
                            {t === 'chart' ? 'Chart' : 'Sales'}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>

                  {/* Both tabs stay mounted so chart period selection and gesture state survive switches.
                      opacity:0 cut hides the old content before display switches; fade-in reveals new. */}
                  <Animated.View style={[{ width: '100%' }, contentFadeStyle]}>
                    <View
                      style={{ display: priceTab === 'chart' ? 'flex' : 'none', width: '100%' }}
                    >
                      <FullPriceGraph<Record<string, string | number>>
                        xKey={'date' as GraphInputKey<typeof priceChartingData>}
                        yKeys={selectedGrades}
                        data={mergedPriceData.length ? mergedPriceData : undefined}
                        colors={selectedGrades.map((g) => gradeColors[g] ?? COLOR_RANGE[0])}
                        pending={!optimisticPriceData && priceChartingData?.pending}
                        fetching={Boolean(priceChartingData?.pending)}
                      />
                    </View>
                    <View
                      style={{
                        display: priceTab === 'sales' ? 'flex' : 'none',
                        width: '100%',
                        paddingHorizontal: 16,
                      }}
                    >
                      {mergedPriceData.length === 0 ? (
                        <SalesListSkeleton />
                      ) : (
                        <RecentSalesList
                          priceData={mergedPriceData}
                          selectedGrades={selectedGrades}
                          gradeColors={gradeColors}
                        />
                      )}
                    </View>
                  </Animated.View>
                </View>
              </GradeColorsProvider>
            ),
          },
          {
            header: <CardScreenHeader title={'Offers'} />,
          },
        ]}
      />

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
  sections,
}: {
  cardId: string
  displayData: DisplayData | null
  animateFrom: Coordinates
  children?: ReactNode
  title: ReactNode
  returnTo?: Href
  sections?: Array<{ header: ReactNode; content?: ReactNode }>
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

  // Resolve image first so the aspect ratio is available for animation targets below.
  const { data: imageResult } = useImageProxy({
    cardId: cardId,
    imageType: 'front',
    quality: 100,
    ...displayData?.imageProxyArgs,
    variant: 'detail',
    shape: 'card',
  })
  const image = imageResult?.url
  const imageShape = imageResult?.shape
  // W/H pixel aspect ratio — prefer live image-proxy result, then displayData (pre-computed
  // from card.image dimensions returned by fetch-card), then standard card ratio as final fallback.
  const cardAspectRatio = imageResult?.aspectRatio ?? displayData?.aspectRatio ?? 5 / 7

  // Header height = card's own height (at CARD_WIDTH_RATIO) + top clearance.
  // Sizing the container to the card's intrinsic dimensions instead of the full-width
  // aspectRatio (which would make the container ~W/ratio ≈ 550 px on a standard card).
  const headerHeight = (W * CARD_WIDTH_RATIO) / cardAspectRatio + insets.top + 20

  const { data: thumbnailImageResult } = useImageProxy({
    ...displayData?.imageProxyArgs,
    variant: 'tiny',
  })
  const thumbnailImage = thumbnailImageResult?.url

  const animateTo = {
    width: W * CARD_WIDTH_RATIO,
    height: (W * CARD_WIDTH_RATIO) / cardAspectRatio,
    x: (W * (1 - CARD_WIDTH_RATIO)) / 2,
    y: insets.top + 44,
  }

  const {
    progress,
    cardStyle: cardTransition,
    scrimStyle,
    close,
  } = useTransitionAnimation(animateFrom, {
    fallbackHref: returnTo,
    animateTo,
    ready: !!imageContainerLayout,
  })
  const CARD_TITLE_POSITION = 1.0

  const y = useSharedValue(0)

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y
    y.set(offsetY)
  }, [])
  const travelDistance = CARD_TITLE_POSITION * headerHeight
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
            [measuredHeaderHeight.value, measuredHeaderHeight.value * 0.5]
          )
        : 'auto',
  }))

  const backScale = useSharedValue(1)
  const backButtonAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [{ scale: backScale.value }],
  }))

  const cardImageAnimStyle = useAnimatedStyle(() => ({
    width: interpolate(
      expandProgress.value,
      [0, 1],
      [W * CARD_WIDTH_RATIO, W],
      Extrapolation.CLAMP
    ),
    top: interpolate(expandProgress.value, [0, 1], [insets.top + 68, -40], Extrapolation.CLAMP),
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
                  height: headerHeight,
                },
              ]}
            >
              <Animated.View
                style={[
                  cardTransition,
                  cardImageAnimStyle,
                  {
                    aspectRatio: cardAspectRatio,
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
                  key={image}
                  source={[
                    {
                      uri: image,
                      cacheKey: `${displayData?.imageProxyArgs.queryHash || `${displayData?.imageProxyArgs.cardId}-thumb`}`,
                      width: W * CARD_WIDTH_RATIO,
                      // height: (W * CARD_WIDTH_RATIO) / (5 / 7),
                    },
                  ]}
                  placeholder={
                    thumbnailImage
                      ? {
                          uri: thumbnailImage,
                          cacheKey: `${cardId}-thumb`,
                          width: W,
                          height: W / cardAspectRatio,
                        }
                      : undefined
                  }
                  placeholderContentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                  contentFit="fill"
                />
              </Animated.View>
            </View>
          </AMaskedView>
        </View>
        <GradientBackground
          start={{ x: 0.5, y: 1.0 }}
          end={{ x: 0.5, y: 0.0 }}
          colors={[Colors.$backgroundDefault, 'transparent']}
          positions={[0, 1.0]}
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
        <Animated.View
          style={[
            {
              position: 'absolute',
              zIndex: 20,
              left: animateTo.x - 52,
              top: animateTo.y / 1.5,
            },
            backButtonAnimStyle,
          ]}
        >
          <Pressable
            onPress={close}
            onPressIn={() => {
              backScale.value = withSpring(0.82, { damping: 14, stiffness: 220 })
            }}
            onPressOut={() => {
              backScale.value = withSpring(1, { damping: 12, stiffness: 200 })
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.48)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} color="rgba(255,255,255,0.92)" />
          </Pressable>
        </Animated.View>
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

        <MaskedView
          style={{ flex: 1, width: W }}
          maskElement={
            <LinearGradient
              colors={['transparent', 'black', 'black', 'transparent']}
              locations={[0, 0.04, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', height: '100%', width: '100%' }}
            />
          }
        >
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16} // ~60fps updates
            stickyHeaderIndices={sections ? sections.map((_, i) => 1 + i * 2) : []}
            scrollEnabled={false}
            ref={scrollViewRef}
            onLayout={onListLayout}
            onContentSizeChange={onContentSizeChange}
            style={{ width: W, flex: 1 }}
            contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
          >
            {/* index 0 — scrim wrapper carries the entry-fade opacity; sections start at 1 */}
            <Animated.View style={[{ position: 'relative' }, scrimStyle]}>
              {!sections && <View>{children}</View>}
            </Animated.View>

            {sections?.flatMap(({ header, content }, i) => [
              <View key={`sh-${i}`}>{header}</View>,
              <View key={`sc-${i}`}>{content}</View>,
            ])}
          </Animated.ScrollView>
        </MaskedView>
      </Animated.View>
    </GestureDetector>
  )
}
