import { useCardQuery } from '@/client/card'
import { CollectionItemImage, useCollectionItemPhotos } from '@/client/collections/photos'
import { useViewSingleCollectionItem } from '@/client/collections/query'
import { useImageProxy } from '@/client/image-proxy'
import { GradientBackground } from '@/components/Background'
import { gradientColors } from '@/components/graphs/helpers'
import FullPriceGraph from '@/components/graphs/PriceGraph'
import { GraphInputKey } from '@/components/graphs/ui/types'
import { useMeasure } from '@/components/hooks/useMeasure'
import { CARD_WIDTH_RATIO } from '@/components/tcg-card/consts'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { useInvalidateOnFocus } from '@/components/tcg-card/helpers'
import { getDefaultCardPlaceholderSource } from '@/components/tcg-card/placeholders'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { chunk, formatLabel, formatPrice } from '@/components/utils'
import { useCollaspableHeader } from '@/features/collection/ui'
import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { qk } from '@/lib/store/functions/helpers'
import { useTabBarStore } from '@/lib/store/useTabBarStore'
import { useUserStore } from '@/lib/store/useUserStore'
import MaskedView from '@react-native-masked-view/masked-view'
import { useFocusEffect } from '@react-navigation/native'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Href } from 'expo-router'
import { ArrowLeft, Eye, EyeOff, Undo2 } from 'lucide-react-native'
import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
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
import { Colors, Dialog, PanningDirectionsEnum } from 'react-native-ui-lib'
import { buildThumbCacheKey, getCardDisplayData, orderCarouselPhotos } from '../helpers'
import { PriceSummaryBar } from '../PriceSummaryBar'
import { RecentSalesList } from '../RecentSalesList'
import { DisplayData } from '../types'
import { CardScreenHeader } from './components/CardScreenHeader'
import { CollectionInfoCard } from './components/CollectionInfoCard'
import { Prices } from './components/Prices'
import { Footer } from './footer/footer'
import { GradeColorsProvider } from './GradeColorsProvider'
import { Coordinates, useSelectedGrades, useTransitionAnimation } from './helpers'
import { AddToCollectionsView } from './pages/add-to-collections'
import { CreateCollectionView } from './pages/create-collection'
import { CardDetailsProvider, useCardDetails } from './provider'

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

const { width: W, height: H } = Dimensions.get('window')

const AImage = Animated.createAnimatedComponent(Image)

export default function FocusCardView({
  cardId,
  collectionIdArgs,
  animateFrom,
  returnTo,
  preferredImageId,
}: {
  cardId: string
  collectionIdArgs?: { collectionId: string; itemId: string }
  animateFrom: { x: number; y: number; width: number; height: number }
  returnTo?: Href
  /**
   * The primary photo's `image_cache_id`, already resolved by whichever list
   * tile navigated here — lets the hero image render straight away instead
   * of the vendor card image while this screen's own `useViewSingleCollectionItem`
   * fetch (which embeds the primary photo) is still in flight.
   */
  preferredImageId?: string
}) {
  const { data: cardData } = useCardQuery(cardId)
  const { data: collectionItem } = useViewSingleCollectionItem(collectionIdArgs?.itemId)

  // The (tabs) navigator's floating CustomTabBar stays mounted (and visible, since this
  // screen is a transparentModal) behind both routes that render this component, where it
  // visually overlaps this view's own footer. Hide it for as long as we're focused.
  //
  // Tied to focus rather than plain mount/unmount: native-stack keeps screens mounted
  // underneath when navigating away (tab switch, another screen pushed on top), so a
  // mount/unmount-based push()/pop() pair can leave pop() never firing — permanently
  // stuck-hiding the tab bar after "exiting". useFocusEffect's cleanup reliably runs on
  // blur even when the screen stays mounted.
  useFocusEffect(
    useCallback(() => {
      useTabBarStore.getState().push()
      return () => {
        useTabBarStore.getState().pop()
      }
    }, [])
  )

  // Only true when this item's owner is the signed-in user — the same route
  // (/profile/[shop-item]) renders both a user's own storefront preview and
  // other users' public storefronts, so ownership can't be inferred from the
  // route alone.
  const authUserId = useUserStore((s) => s.user?.id)
  const isOwnCollectionItem = Boolean(
    collectionItem && authUserId && collectionItem.user_id === authUserId
  )

  // `useViewSingleCollectionItem` embeds the item's primary photo directly on
  // `collectionItem` now (`primary_image_cache_id`, always `string | null` rather than
  // `undefined` once the row has loaded) — getCardDisplayData reads that straight off
  // `collectionItem`, no separate usePrimaryPhoto(collectionItem.id) round trip needed
  // (that second, independently-racing fetch was the root cause of this screen
  // repeatedly showing the vendor image before swapping to the real preferred photo).
  //
  // `primaryPhoto`/`primaryPhotoLoading` below only matter for the window before
  // `collectionItem` itself has loaded: fall back to the id handed off via navigation
  // params (already resolved by whichever list tile navigated here) rather than the
  // vendor card image while that fetch is in flight.
  const primaryPhoto = preferredImageId ? { image_cache_id: preferredImageId } : null
  const primaryPhotoLoading = !collectionItem && !preferredImageId
  const displayData = useMemo(
    () => getCardDisplayData({ card: cardData, collectionItem, primaryPhoto, primaryPhotoLoading }),
    [cardData, collectionItem, primaryPhoto, primaryPhotoLoading]
  )

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
      // "Save Card To", not "Add to Collection" — that exact phrase already names a different
      // screen/workflow (features/collection/pages/add-card.tsx, reached from inside a
      // collection to search for a card to add TO it). This one is the reverse: picking which
      // collection(s) to save THIS card into.
      { title: 'Save Card To', page: AddToCollectionsView },
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
        collectionItemId={collectionIdArgs?.itemId}
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
        modalProps={{ overlayBackgroundColor: Colors.rgba(Colors.grey10, 0.8) }}
        direction={PanningDirectionsEnum.DOWN}
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
      <Footer
        card={cardData}
        isOwnCollectionItem={isOwnCollectionItem}
        collectionItemId={collectionIdArgs?.itemId}
        displayData={displayData}
        collectionItem={collectionItem}
      />
    </CardDetailsProvider>
  )
}

const AMaskedView = Animated.createAnimatedComponent(MaskedView)

const CardDetailContainer = ({
  children,
  displayData,
  animateFrom,
  cardId,
  collectionItemId,
  title,
  returnTo,
  sections,
}: {
  cardId: string
  displayData: DisplayData | null
  animateFrom: Coordinates
  collectionItemId?: string
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

  const scheme = useEffectiveColorScheme()
  const defaultBackground = useMemo(() => Colors.$backgroundDefault, [scheme])
  const insets = useSafeAreaInsets()

  // Resolve image first so the aspect ratio is available for animation targets below.
  //
  // Built explicitly (not spread over a cardId/imageType base) so the query args — and
  // therefore the cache key — exactly match CarouselPhotoSlide's for the same photo.
  // Previously cardId/imageType leaked through even when imageProxyArgs.imageId was set
  // (object spread only overwrites keys actually present in the spread source), so this
  // query and the carousel's first slide had different cache keys for the same preferred
  // photo — the carousel had to refetch from scratch, showing a blank slide right as the
  // entrance animation played instead of the already-resolved image.
  const { data: imageResult } = useImageProxy(
    displayData?.imageProxyArgs.imageId
      ? {
          imageId: displayData.imageProxyArgs.imageId,
          quality: 100,
          variant: 'detail',
          shape: 'card',
        }
      : {
          cardId,
          imageType: 'front',
          queryHash: displayData?.imageProxyArgs.queryHash,
          directUrl: displayData?.imageProxyArgs.directUrl,
          quality: 100,
          variant: 'detail',
          shape: 'card',
        }
  )
  const image = imageResult?.url
  // W/H pixel aspect ratio — prefer live image-proxy result, then displayData (pre-computed
  // from card.image dimensions returned by fetch-card), then standard card ratio as final fallback.
  const cardAspectRatio = imageResult?.aspectRatio ?? displayData?.aspectRatio ?? 5 / 7
  const { data: thumbnailImageResult } = useImageProxy({
    ...displayData?.imageProxyArgs,
    variant: 'tiny',
  })
  const thumbnailImage = thumbnailImageResult?.url

  // Swiping between photos only makes sense once the card has actually reached its
  // resting position — see the `onOpen` callback passed to useTransitionAnimation below.
  // Lives in the shared CardDetailsStore (not local state) so Footer — a sibling of this
  // component, not a descendant — can also read it to time its own entrance animation.
  const {
    heroImageInPosition: introComplete,
    setHeroImageInPosition: setIntroComplete,
    setHeroImageReady,
  } = useCardDetails()
  // All of this item's own uploaded photos, reordered so whichever one is primary — the
  // one already on display — leads the carousel; swiping reveals the rest in their
  // existing order. Only fetched once the entrance animation has finished so the extra
  // photos' fetch/decode work doesn't compete with it — the carousel loads in after.
  const { data: itemPhotos = [] } = useCollectionItemPhotos(
    introComplete ? collectionItemId : undefined
  )
  const carouselPhotos = useMemo(() => orderCarouselPhotos(itemPhotos), [itemPhotos])
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)

  // Always add the safe-area top inset ourselves rather than relying on whether a screen
  // is mounted behind us — router.canGoBack() reflects the whole navigation history, not
  // specifically whether this transparentModal has a screen visible underneath, so it
  // isn't a reliable signal (e.g. it could report a screen behind us that doesn't actually
  // reserve space here, under-padding the header at the very top of the app).
  const animateTo = {
    width: W * CARD_WIDTH_RATIO,
    height: (W * CARD_WIDTH_RATIO) / cardAspectRatio,
    x: (W * (1 - CARD_WIDTH_RATIO)) / 2,
    y: insets.top + ((W - W * CARD_WIDTH_RATIO) / 2) * 0.66,
  }

  const headerHeight = (W * CARD_WIDTH_RATIO) / cardAspectRatio + animateTo.y
  const collaspedHeaderHeight = animateTo.y / 1.5 + 52

  // Optimistic — gated on the container's own layout measurement only, NOT on the hero image
  // having actually loaded/decoded. imageContainerLayout is a pure layout event (effectively
  // immediate, independent of any network/decode work); waiting on the image too meant the
  // whole entrance (card zoom + footer, see heroImageReady below) blocked on a real fetch. The
  // image itself still renders whatever's already available and swaps to the sharper one the
  // moment it lands (expo-image's own placeholder→source mechanism on the AImage below,
  // unrelated to this gate) — the shape animates in now; the content catches up independently.
  const entranceReady = !!imageContainerLayout
  // Mirrored into the shared store so Footer (a sibling, not a descendant) can start its own
  // entrance the instant this transition starts moving.
  useEffect(() => {
    setHeroImageReady(entranceReady)
  }, [entranceReady, setHeroImageReady])

  const {
    progress,
    animation: entranceAnimation,
    cardStyle: cardTransition,
    scrimStyle,
    close,
  } = useTransitionAnimation(animateFrom, {
    fallbackHref: returnTo,
    animateTo,
    ready: entranceReady,
    onOpen: () => setIntroComplete(true),
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
            [measuredHeaderHeight.value, collaspedHeaderHeight]
          )
        : 'auto',
  }))

  const backScale = useSharedValue(1)
  const backButtonAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [{ scale: backScale.value }],
  }))

  // Fades the screen's own background in as the card animates from its list
  // position to the target (progress: 0 → 1), rather than snapping straight
  // to opaque — animates the color's alpha channel, not the view's opacity,
  // so it doesn't fade the content sitting on top of it.
  //
  // Ramps fully opaque by progress: 0.25 — position/size and progress share one
  // withTiming call (see useAnimateFromPosition), so they're always in lockstep, and
  // easeOutEmphasized covers most of the animateFrom→animateTo travel distance early;
  // finishing the dim ramp this early hides the screen behind well before the card has
  // moved far from its origin. (A "stationary leftover photo" bug was suspected to be
  // this screen dimming too slowly, letting the tile behind show through — ruled out by
  // testing with this forced fully opaque from frame 0: the leftover photo persisted
  // unchanged, so it isn't the screen behind bleeding through at all. Leading theory now
  // is a native react-native-screens view-snapshot artifact, outside this component
  // entirely — see conversation. Reverted to the [0, 0.25] ramp since it's a real
  // improvement over the original [0, 0.7] regardless.)
  const transitionBackgroundColors = useSharedValue([
    Colors.rgba(defaultBackground, 0) as string,
    Colors.rgba(defaultBackground, 1) as string,
  ])
  const screenBackgroundAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 0.25], transitionBackgroundColors.value),
  }))

  const cardImageAnimStyle = useAnimatedStyle(() => ({
    width: interpolate(
      expandProgress.value,
      [0, 1],
      [W * CARD_WIDTH_RATIO, W],
      Extrapolation.CLAMP
    ),
    // top/left track the live entrance position (entranceAnimation.value), not the
    // static animateTo target, at expandProgress=0 — this view and cardTransition both
    // set top/left on the same Animated.View, and since this style is applied after
    // cardTransition in the array, it otherwise always wins (later entry overrides for
    // the same key). With a static animateTo.y/x baseline, that meant the card rendered
    // at its *final* resting position from the very first frame, masking the entire
    // animateFrom → animateTo entrance animation (visible as a flash of the card already
    // sitting at its target destination on open). Tracking the live value keeps this in
    // sync with cardTransition during the entrance, then naturally settles once
    // entranceAnimation reaches `to` (which equals animateTo) — matching the previous
    // resting-state values exactly for the post-entrance scroll-collapse behavior below.
    top: interpolate(
      expandProgress.value,
      [0, 1],
      [entranceAnimation.value.y, -0],
      Extrapolation.CLAMP
    ),
    left: interpolate(
      expandProgress.value,
      [0, 1],
      [entranceAnimation.value.x, 0],
      Extrapolation.CLAMP
    ),
    opacity: interpolate(expandProgress.value, [0, 0.1], [1, 0.4], Extrapolation.CLAMP),
    borderRadius: interpolate(expandProgress.value, [0, 0.1], [10, 0], Extrapolation.CLAMP),
  }))

  // Vertical padding tracks the same [0, 1] range as the width/top/left growth above
  // (cardImageAnimStyle) rather than the quick [0, 0.1] opacity/borderRadius snap — the
  // padding exists purely to give PhotoFrameGradient's outward bleed room to render
  // uncropped around a card-shaped photo, so it should shrink in step with the card
  // visually growing out of that "distinct card" shape, not snap away instantly.
  const carouselWrapperStyle = useAnimatedStyle(() => ({
    top: interpolate(
      expandProgress.value,
      [0, 1],
      [-CAROUSEL_VERTICAL_PADDING, 0],
      Extrapolation.CLAMP
    ),
    bottom: interpolate(
      expandProgress.value,
      [0, 1],
      [-CAROUSEL_VERTICAL_PADDING, 0],
      Extrapolation.CLAMP
    ),
    // Crossfades to CarouselExpandedPhoto below on the same quick [0, 0.1] snap as the
    // opacity/borderRadius dim above — once the header starts collapsing, the multi-photo
    // peeking carousel reads as visual noise against a growing full-bleed hero photo.
    opacity: interpolate(expandProgress.value, [0, 0.1], [1, 0], Extrapolation.CLAMP),
  }))

  const carouselExpandedPhotoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.1], [0, 1], Extrapolation.CLAMP),
  }))

  const BackButton = () => (
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
          backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.48),
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$textDefault, 0.16),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft size={18} color={Colors.$iconDefault} />
      </Pressable>
    </Animated.View>
  )

  return (
    <GestureDetector gesture={composedGestures}>
      <Animated.View
        style={[
          {
            width: W,
            height: H,
          },
          screenBackgroundAnimStyle,
        ]}
      >
        <View>
          <Animated.View
            style={[
              {
                overflow: 'visible',
                position: 'relative',
                width: '100%',
              },
              // headerAnimatedStyle,
              headerAStyle,
            ]}
            // maskElement={
            //   <LinearGradient
            //     // MaskedView uses the alpha channel: solid shows content, transparent hides it.
            //     colors={['black', 'black', 'black', '#FFFFFF35']}
            //     start={{ y: 0.0, x: 0.5 }}
            //     end={{ y: 1, x: 0.5 }}
            //     locations={[0, 0.15, 0.85, 1]}
            //     style={{
            //       position: 'absolute',
            //       height: '100%',
            //       width: '100%',
            //       // top: '-2.5%',
            //       left: '-0%',
            //     }}
            //   />
            // }
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
                {carouselPhotos.length > 0 ? (
                  <>
                    {/* Deliberately breaks out of this card box's own (CARD_WIDTH_RATIO*W)
                    width via absolute positioning + a negative left offset — the
                    scrollable viewport is always full screen width, centered on this
                    box's own horizontal center (`animateTo.x` already centers a
                    CARD_WIDTH_RATIO*W-wide box on the W-wide screen, so shifting left by
                    that same amount lands this W-wide wrapper at screen x=0..W). Each
                    CarouselPhotoSlide stays a fixed CAROUSEL_ITEM_WIDTH (see there) —
                    narrower than this viewport — so neighboring photos visibly peek in
                    on either side, faded out via the mask below, with gaps between them.
                    Crossfades out (carouselWrapperStyle) as the header collapses, handing
                    off to CarouselExpandedPhoto below. */}
                    <Animated.View
                      pointerEvents="box-none"
                      style={[
                        {
                          position: 'absolute',
                          // top + bottom (no explicit height) derives this box's height as
                          // "parent's own height + 2*(vertical padding)" — stays correctly
                          // in sync with the card's own animated/aspectRatio-driven height
                          // at any expand/collapse state, unlike a fixed pixel height
                          // would. The padding itself (see carouselWrapperStyle) collapses
                          // to 0 as the header expands, so it's only present in the resting
                          // card-shaped state where PhotoFrameGradient's bleed needs the
                          // room — the ScrollView otherwise clips it, since ScrollView
                          // always clips vertically to its own bounds regardless of
                          // `overflow` styling.
                          left: -animateTo.x,
                          width: W,
                        },
                        carouselWrapperStyle,
                      ]}
                    >
                      <MaskedView
                        style={{ flex: 1 }}
                        maskElement={
                          <LinearGradient
                            colors={['transparent', 'black', 'black', 'transparent']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            locations={[0, 0.08, 0.92, 1]}
                            style={{ flex: 1 }}
                          />
                        }
                      >
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          decelerationRate="fast"
                          snapToInterval={CAROUSEL_ITEM_WIDTH + CAROUSEL_GAP}
                          snapToAlignment="start"
                          // Swiping only takes over once the card has actually reached its
                          // resting position — mid-flight, this is just the primary photo.
                          scrollEnabled={introComplete && carouselPhotos.length > 1}
                          onMomentumScrollEnd={(e) => {
                            const interval = CAROUSEL_ITEM_WIDTH + CAROUSEL_GAP
                            const idx = Math.round(e.nativeEvent.contentOffset.x / interval)
                            setActivePhotoIndex(
                              Math.max(0, Math.min(idx, carouselPhotos.length - 1))
                            )
                          }}
                          style={{ flex: 1 }}
                          contentContainerStyle={{
                            paddingHorizontal: (W - CAROUSEL_ITEM_WIDTH) / 2,
                            gap: CAROUSEL_GAP,
                            alignItems: 'center',
                          }}
                        >
                          {carouselPhotos.map((photo) => (
                            <CarouselPhotoSlide
                              key={photo.id}
                              photo={photo}
                              cardAspectRatio={cardAspectRatio}
                            />
                          ))}
                        </ScrollView>
                      </MaskedView>
                    </Animated.View>
                    {/* The header-collapse counterpart to the peeking carousel above — fills
                    the parent Animated.View exactly like the single-photo (non-carousel)
                    branch below does, so it inherits that parent's own width/top/left
                    growth to W (cardImageAnimStyle) for free instead of hand-tracking
                    expandProgress a second time here. Only crossfades in
                    (carouselExpandedPhotoStyle); shows whichever photo is currently active
                    in the carousel above. */}
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
                        carouselExpandedPhotoStyle,
                      ]}
                    >
                      <CarouselExpandedPhoto
                        photo={carouselPhotos[activePhotoIndex] ?? carouselPhotos[0]}
                      />
                    </Animated.View>
                  </>
                ) : (
                  <>
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
                          // '-detail', NOT '-thumb': this is the full 'detail'/quality-100
                          // rendition. card-image.tsx's list-tile thumbnail uses the SAME
                          // imageId with a '-thumb' suffix for its own 'tiny' variant — if
                          // this used '-thumb' too, both differently-sized/cropped images
                          // would collide on one cacheKey, and expo-image could serve the
                          // list tile's already-cached tiny/blurry bitmap here first (visible
                          // as a wrong/low-res photo mid zoom-in, self-correcting once the
                          // real detail-quality fetch lands). Matches CarouselPhotoSlide's
                          // cacheKey below, which is genuinely the same rendition.
                          cacheKey: `${
                            displayData?.imageProxyArgs.queryHash ||
                            displayData?.imageProxyArgs.imageId ||
                            displayData?.imageProxyArgs.cardId
                          }-detail`,
                          width: W * CARD_WIDTH_RATIO,
                        },
                      ]}
                      placeholder={
                        thumbnailImage
                          ? {
                              uri: thumbnailImage,
                              // Shares buildThumbCacheKey with card-image.tsx's list-tile
                              // thumbnail — when this item has a user-uploaded primary photo
                              // (imageId set), that photo's '-thumb' bitmap is what the list
                              // tile the user just tapped from already rendered, so it's warm
                              // in cache and this placeholder loads near-instantly instead of
                              // missing the cache on a divergent key.
                              cacheKey: displayData
                                ? buildThumbCacheKey(displayData.imageProxyArgs)
                                : undefined,
                              width: W,
                              height: W / cardAspectRatio,
                            }
                          : // Neither the thumbnail nor the detail image has a URL yet (both are
                            // still waiting on their own useImageProxy fetch) — the generic card
                            // placeholder, warmed into cache at app load (CardPlaceholderPrefetch,
                            // app/_layout.tsx) at this exact width/height, so it's already there
                            // instead of this being a cold fetch on first open. Whichever of
                            // thumbnailImage/image resolves first still replaces it immediately,
                            // same as always — this only fills the gap before either has.
                            getDefaultCardPlaceholderSource(
                              W * CARD_WIDTH_RATIO,
                              (W * CARD_WIDTH_RATIO) / cardAspectRatio
                            )
                      }
                      placeholderContentFit="cover"
                      cachePolicy="memory-disk"
                      transition={0}
                      contentFit="fill"
                      // No onLoad/onError gating here anymore — the entrance animation no longer
                      // waits on this image loading at all (see entranceReady above). The
                      // placeholder (thumbnailImage) and source (image) each swap in on their own
                      // whenever they individually resolve, entirely via expo-image's own
                      // lifecycle — nothing here needs to know when that happens.
                    />
                    <PhotoFrameGradient />
                  </>
                )}
              </Animated.View>
              {/* Pagination dots — deliberately a sibling of (not absolutely overlaid on)
                  the card image above, anchored just below its bottom edge (`top: '100%'`
                  relative to this fixed-height header View, not the animated card box
                  itself) so they read as outside the card rather than overlapping the
                  photo. Absolute + `top: '100%'` rather than normal flow: headerHeight
                  above is sized to exactly the card's own height, with no slack reserved
                  for a flow sibling, and doesn't reflow to make room for one. */}
              {carouselPhotos.length > 1 && (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    marginTop: 10,
                    left: 0,
                    right: 0,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  {carouselPhotos.map((photo, i) => (
                    <View
                      key={photo.id}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor:
                          i === activePhotoIndex
                            ? Colors.$textDefault
                            : Colors.rgba(Colors.$textDefault, 0.35),
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        </View>
        <View style={{ flex: 1, width: W, zIndex: 1 }}>
          <GradientBackground
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 0.5, y: 0.0 }}
            colors={[defaultBackground, defaultBackground]}
            positions={[0, 1.0]}
            opacity={[0, 0]}
            style={{
              zIndex: 2,
              flex: 0,
              width: '100%',
              marginTop: 20,
            }}
          >
            {title}
          </GradientBackground>

          <MaskedView
            style={{ flex: 1, width: W, zIndex: 1 }}
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
          <MaskedView
            pointerEvents="none"
            style={[StyleSheet.absoluteFill]}
            maskElement={
              <View style={{ flex: 1 }}>
                <LinearGradient
                  colors={['transparent', 'black']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{ height: 70, width: '100%' }}
                />
                <View style={{ flex: 1, backgroundColor: 'black' }} />
              </View>
            }
          >
            <BlurView
              tint="systemChromeMaterial"
              intensity={60}
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: Colors.rgba(defaultBackground, 0.35) },
              ]}
            />
          </MaskedView>
        </View>
        <BackButton />
      </Animated.View>
    </GestureDetector>
  )
}

/**
 * The subtle vignette-outline frame drawn around a card photo. Rendered once per photo
 * (see CarouselPhotoSlide) rather than once as a fixed overlay above the whole carousel,
 * so each photo carries its own outline and it visibly scrolls/swipes along with that
 * photo instead of staying pinned in place while different photos scroll underneath it.
 */
function PhotoFrameGradient() {
  return (
    <View
      pointerEvents="none"
      style={{
        width: '106.3%',
        height: '106.8%',
        position: 'absolute',
        top: '-3.15%',
        left: '-3.4%',
        borderColor: 'rgba(110,110,110,1)',
        borderWidth: 1,
      }}
    >
      <LinearGradient
        colors={['rgba(110,110,110,0.2)', 'transparent', 'transparent', 'rgba(110,110,110,0.2)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        locations={[0, 0.1, 0.9, 1]}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
      <LinearGradient
        colors={['rgba(110,110,110,0.2)', 'transparent', 'transparent', 'rgba(110,110,110,0.2)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.1, 0.9, 1]}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
    </View>
  )
}

/** Fixed width of one carousel card — the viewport around it is full screen width (see
 * the peek/fade wrapper in CardDetailContainer), but each card itself stays this same
 * constant size regardless of scroll-collapse state, so neighboring cards visibly peek
 * in in the extra viewport space on either side. */
const CAROUSEL_ITEM_WIDTH = W * CARD_WIDTH_RATIO
// How much of a neighboring card should be visible at rest, in px — the actual gap
// between items is derived from this (see CAROUSEL_GAP below) rather than hardcoded
// directly, so the peek amount stays the same regardless of screen width: the side
// space available for a neighbor to peek into is fixed at
// (W - CAROUSEL_ITEM_WIDTH) / 2 (half the leftover viewport width once the centered
// item is accounted for), and only the portion of that NOT consumed by the gap is
// visible as a peek.
const CAROUSEL_PEEK = 14
const CAROUSEL_GAP = (W - CAROUSEL_ITEM_WIDTH) / 2 - CAROUSEL_PEEK
// Extra vertical space on top of the card's own (animated) height so
// PhotoFrameGradient's outward bleed (106.8% height / -3.15% top offset) isn't clipped
// by the ScrollView's cross-axis clipping — ScrollView always clips vertically to its
// own bounds regardless of `overflow` styling, so the bounds themselves need to be
// slightly taller than each item, not just the item's own box.
const CAROUSEL_VERTICAL_PADDING = 12

function CarouselPhotoSlide({
  photo,
  cardAspectRatio,
}: {
  photo: CollectionItemImage
  cardAspectRatio: number
}) {
  // Options mirror CardDetailContainer's own hero query exactly (same imageId → same
  // cache key), so the primary photo's slide reuses that already-resolved data instead
  // of refetching from a blank state right as the entrance animation plays.
  const { data: proxy } = useImageProxy({
    imageId: photo.image_cache_id,
    quality: 100,
    variant: 'detail',
    shape: 'card',
  })
  return (
    <View style={{ width: CAROUSEL_ITEM_WIDTH, aspectRatio: cardAspectRatio }}>
      <Image
        style={{ width: '100%', height: '100%', borderRadius: 6 }}
        // '-detail', matching the hero AImage's cacheKey above — this is the same
        // quality-100 'detail' rendition, not the '-thumb' tiny variant used elsewhere.
        source={{ uri: proxy?.url, cacheKey: `${photo.image_cache_id}-detail` }}
        cachePolicy="memory-disk"
        transition={0}
        contentFit="fill"
      />
      <PhotoFrameGradient />
    </View>
  )
}

/** Header-collapsed counterpart to CarouselPhotoSlide — fills its parent 100% (rather
 * than a fixed CAROUSEL_ITEM_WIDTH) since its parent is the same Animated.View that
 * already grows to full screen width via cardImageAnimStyle, exactly like the
 * non-carousel single-photo branch's AImage does. */
function CarouselExpandedPhoto({ photo }: { photo: CollectionItemImage }) {
  const { data: proxy } = useImageProxy({
    imageId: photo.image_cache_id,
    quality: 100,
    variant: 'detail',
    shape: 'card',
  })
  return (
    <>
      <Image
        style={{ width: '100%', height: '100%', borderRadius: 6 }}
        source={{ uri: proxy?.url, cacheKey: `${photo.image_cache_id}-detail` }}
        cachePolicy="memory-disk"
        transition={0}
        contentFit="fill"
      />
      <PhotoFrameGradient />
    </>
  )
}
