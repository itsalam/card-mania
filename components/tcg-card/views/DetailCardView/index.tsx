import { useCardQuery } from '@/client/card'
import { useImageProxy } from '@/client/image-proxy'
import { BlurBackground } from '@/components/Background'
import PriceGraph from '@/components/graphs/PriceGraph'
import { GraphInputKey } from '@/components/graphs/ui/types'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { useInvalidateOnFocus } from '@/components/tcg-card/helpers'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { chunk, formatLabel, formatPrice } from '@/components/utils'
import { qk } from '@/lib/store/functions/helpers'
import { Image } from 'expo-image'
import { Eye, EyeOff, Undo2, X } from 'lucide-react-native'
import { SafeAreaView } from 'moti'
import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
  ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Colors, Dialog, PanningProvider, Spacings } from 'react-native-ui-lib'
import Carousel from 'react-native-ui-lib/carousel'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../../consts'
import { AddToCollectionsView } from './footer/add-to-collections'
import { CreateCollectionView } from './footer/create-collections'
import { Footer } from './footer/footer'
import { useSelectedGrades, useTransitionAnimation } from './helpers'
import { CardDetailsProvider, useCardDetails } from './provider'
import { Attribute, CardScreenHeader, Prices } from './ui'

const { width: W, height: H } = Dimensions.get('window')

export default function FocusCardView({
  cardId,
  animateFrom,
}: {
  cardId: string
  animateFrom: { x: number; y: number; width: number; height: number }
}) {
  console.log('LOADED!!')
  const { data: cardData } = useCardQuery(cardId)

  const { cardStyle, scrimStyle, close } = useTransitionAnimation(animateFrom)

  const {
    data: image,
    isLoading: isImageLoading,
    status,
  } = useImageProxy({
    variant: 'detail',
    shape: 'card',
    cardId: cardId,
    kind: 'front',
    queryHash: cardData?.image?.query_hash ?? undefined,
  })

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

  const [images, setImages] = useState([])

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
        cardStyle={cardStyle}
        scrimStyle={scrimStyle}
        cardId={cardId}
        image={image}
        handleClose={close}
      >
        <CardScreenHeader title={'Overview'} />
        <View className="px-8 flex flex-col items-start justify-stretch gap-4 w-full">
          <View>
            <Heading size="4xl">{cardData?.name}</Heading>
            <Heading className="font-spaceMono font-bold" size="xl">
              {cardData?.set_name}
            </Heading>
          </View>

          <View className="w-full py-4 ">
            <View
              style={{
                minHeight: (W * 0.4 * 7) / 5,
                display: 'none',
              }}
              className="flex-row justify-between w-full"
            >
              <Carousel
                style={{ flex: 1, minHeight: (W * 0.4 * 7) / 5, width: W * 0.4 }}
                pageHeight={(W * 0.4 * 7) / 5}
                itemSpacings={10}
                pageControlPosition={Carousel.pageControlPositions.UNDER}
                showCounter={images.length >= 2}
              >
                <Image
                  style={{ height: (W * 0.4 * 7) / 5, aspectRatio: 5 / 7, borderRadius: 4 }}
                  source={{ uri: image, cacheKey: cardId }}
                  cachePolicy="memory-disk"
                  transition={0}
                  contentFit="cover"
                />
              </Carousel>
              <View className="flex-1 pl-4">
                {cardData?.release_date && (
                  <Attribute
                    label="Released"
                    value={new Date(cardData?.release_date).toLocaleDateString()}
                  />
                )}
                <Attribute label="Genre" value={cardData?.genre || '--'} />
                {cardData?.last_updated && (
                  <Attribute
                    label="Last Updated"
                    value={new Date(cardData?.last_updated).toLocaleDateString()}
                  />
                )}
                {/* <Text>{data?.description}</Text> */}
              </View>
            </View>
          </View>
        </View>

        <View className="flex flex-col items-start justify-stretch gap-2 w-full">
          <CardScreenHeader title={'Prices'} />
          <Prices
            prices={prices}
            visibleGrades={visibleGrades}
            setSelectedGrades={setSelectedGrades}
            setShowMoreGrades={setShowMoreGrades}
            selectedGrades={selectedGrades}
          />

          <PriceGraph<Record<string, string | number>>
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

const CardDetailContainer = ({
  children,
  cardStyle,
  image,
  cardId,
  handleClose,
}: {
  cardId: string
  image?: string
  cardStyle: ViewStyle
  scrimStyle: ViewStyle
  handleClose: () => void
  children: ReactNode
}) => {
  const { footerFullView, setFooterFullView } = useCardDetails()
  const container = useAnimatedStyle(() => ({
    opacity: withTiming(footerFullView ? 0.3 : 1.0),
  }))
  const footerFullViewSV = useSharedValue(footerFullView)

  // 2. Keep it in sync when React state changes
  useEffect(() => {
    footerFullViewSV.value = footerFullView
  }, [footerFullView, footerFullViewSV])

  const y = useSharedValue(0)

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y
    y.set(offsetY)
  }, [])
  const travelDistance = 0.6 * ((W * 7) / 5)
  const scrollProgress = useDerivedValue(() =>
    Math.min(Math.max(0, y.value / (travelDistance / 3)), 1)
  )
  const opacity = useDerivedValue(
    () => Math.min(Math.max(0, scrollProgress.value), 1),
    [scrollProgress]
  )

  const containerPadding = useAnimatedStyle(() => ({
    paddingTop: travelDistance * (1 - scrollProgress.value),
  }))

  const backgroundOpacity = useDerivedValue(() => [1, Math.min(opacity.value, 0.8)], [opacity])

  const insets = useSafeAreaInsets()

  return (
    <Animated.View
      style={[
        {
          width: W,
          height: H,
        },
      ]}
    >
      <Animated.View style={[cardStyle, { transform: [{ translateY: insets.top }] }]}>
        <Image
          style={{ width: '100%', aspectRatio: 5 / 7 }}
          source={[{ uri: image, cacheKey: cardId, width: W, height: W / (5 / 7) }]}
          placeholder={{
            cacheKey: `${cardId}-thumb`,
            width: THUMBNAIL_WIDTH,
            height: THUMBNAIL_HEIGHT,
          }}
          cachePolicy="memory-disk"
          transition={0}
          contentFit="cover"
        />
      </Animated.View>
      <BlurBackground
        backgroundOpacity={backgroundOpacity}
        start={{ x: 0.5, y: 0.8 }}
        end={{ x: 0.5, y: 0 }}
        opacity={opacity}
      >
        <Animated.View
          onStartShouldSetResponderCapture={() => {
            // When footer is full view, capture touches so children don't see them
            return footerFullViewSV.value
          }}
          // Handle the "pointer up" equivalent
          onResponderRelease={(e) => {
            if (footerFullViewSV.value) {
              setFooterFullView(false)
            }
          }}
          style={[
            container,
            {
              width: W,
              height: H,
            },
          ]}
        >
          <SafeAreaView className="overflow-visible" style={{ width: '100%' }}>
            <Button
              onPress={handleClose}
              style={{ position: 'absolute', left: 16, top: insets.top + 16, zIndex: 20 }}
            >
              <X size={20} />
            </Button>
            <ScrollView
              onScroll={onScroll}
              scrollEventThrottle={16} // ~60fps updates
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              className="h-full overflow-visible"
              contentContainerClassName="flex flex-col items-start justify-stretch gap-4 pt-4"
            >
              <Animated.View
                style={[
                  {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: Spacings.s4,
                    paddingTop: Spacings.s4,
                  },
                  containerPadding,
                ]}
              >
                {children}
              </Animated.View>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </BlurBackground>
    </Animated.View>
  )
}
