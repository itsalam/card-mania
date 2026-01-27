import { useCardQuery } from '@/client/card'
import { useImageProxy } from '@/client/image-proxy'
import { BlurGradientBackground } from '@/components/Background'
import PriceGraph from '@/components/graphs/PriceGraph'
import { GraphInputKey } from '@/components/graphs/ui/types'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { useInvalidateOnFocus } from '@/components/tcg-card/helpers'
import { Text } from '@/components/ui/text'
import { chunk, formatLabel, formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { qk } from '@/lib/store/functions/helpers'
import { Image } from 'expo-image'
import { Href } from 'expo-router'
import { Eye, EyeOff, Undo2, X } from 'lucide-react-native'
import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
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
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Colors, Dialog, PanningProvider } from 'react-native-ui-lib'

import { Footer } from './footer/footer'
import { AddToCollectionsView } from './footer/pages/add-to-collections'
import { CreateCollectionView } from './footer/pages/create-collection'
import { Coordinates, useSelectedGrades, useTransitionAnimation } from './helpers'
import { CardDetailsProvider, useCardDetails } from './provider'
import { CardScreenHeader, Prices } from './ui'

const { width: W, height: H } = Dimensions.get('window')

export default function FocusCardView({
  cardId,
  animateFrom,
  returnTo,
}: {
  cardId: string
  animateFrom: { x: number; y: number; width: number; height: number }
  returnTo?: Href
}) {
  const { data: cardData } = useCardQuery(cardId)

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
        cardData={cardData}
        title={
          <View className="p-8 flex flex-col items-start justify-stretch gap-1 w-full pt-0">
            <Text variant="h1">{cardData?.name}</Text>
            <Text className="font-spaceMono font-bold" variant="h2">
              {cardData?.set_name}
            </Text>
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
  cardData,
  animateFrom,
  cardId,
  title,
  returnTo,
}: {
  cardId: string
  cardData?: TCard
  animateFrom: Coordinates
  children: ReactNode
  title: ReactNode
  returnTo?: Href
}) => {
  const {
    cardStyle: cardTransition,
    scrimStyle,
    close,
  } = useTransitionAnimation(animateFrom, {
    fallbackHref: returnTo,
  })
  const insets = useSafeAreaInsets()
  const TITLE_SPACING = 72 + insets.top
  const CARD_TITLE_POSITION = 1.0
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
  const travelDistance = CARD_TITLE_POSITION * ((W * 7) / 5) - TITLE_SPACING
  const scrollProgress = useDerivedValue(() => Math.max(0, y.value / travelDistance))
  const mainBlur = useDerivedValue(
    () => interpolate(scrollProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    [scrollProgress]
  )

  const titleBlur = useDerivedValue(
    () => interpolate(scrollProgress.value, [1.0, 1.2], [0, 0.8], Extrapolation.CLAMP),
    [scrollProgress]
  )

  const backgroundOpacity = useDerivedValue(
    () => [1, interpolate(scrollProgress.value, [0, 1], [0, 0.8], Extrapolation.CLAMP)],
    [scrollProgress]
  )

  const titleOpacity = useDerivedValue(
    () => [interpolate(scrollProgress.value, [0.8, 1.0], [0, 0.8], Extrapolation.CLAMP), 1, 0.9, 0],
    [scrollProgress]
  )

  const { data: image } = useImageProxy({
    variant: 'detail',
    shape: 'card',
    cardId: cardId,
    imageType: 'front',
    quality: 100,
    queryHash: cardData?.image?.query_hash ?? undefined,
  })

  const { data: thumbnailImage } = useImageProxy({
    variant: 'tiny',
    shape: 'card',
    cardId: cardId,
    imageType: 'front',
    queryHash: cardData?.image?.query_hash ?? undefined,
  })

  const placeHolderBlur = useSharedValue(0)

  useEffect(() => {
    placeHolderBlur.value = interpolate(
      Number(Boolean(image)) * 500,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    )
  }, [cardId, image])

  const handleImageLoadStart = useCallback(() => {
    if (image) {
      placeHolderBlur.value = withTiming(500, { duration: 200 })
    }
  }, [image])

  const handleImageLoad = useCallback(() => {
    placeHolderBlur.value = withTiming(0, { duration: 200 })
  }, [])

  const cardScrollTransition = useAnimatedStyle(
    () => ({
      transformStyle: 'top center',
      transform: [
        {
          translateY: 44,
        },
        {
          scale: withTiming(
            interpolate(scrollProgress.value, [0, 0.15], [1, 5 / 6], Extrapolation.CLAMP),
            { duration: 200 }
          ),
        },
      ],
    }),
    [scrollProgress]
  )

  return (
    <Animated.View
      style={[
        {
          width: W,
          height: H,
          backgroundColor: Colors.rgba(Colors.$backgroundNeutralLight, 1.0),
        },
      ]}
    >
      {thumbnailImage && (
        <Image
          style={[StyleSheet.absoluteFillObject, { opacity: 0.2 }]}
          source={{
            uri: thumbnailImage,
            cacheKey: `${cardId}-thumb-bg`,
            width: W,
            height: H,
          }}
          blurRadius={2}
          contentFit="cover"
          transition={200}
          pointerEvents="none"
        />
      )}

      <BlurGradientBackground
        backgroundOpacity={backgroundOpacity}
        start={{ x: 0.5, y: 1.0 }}
        end={{ x: 0.5, y: 0.0 }}
        colors={[Colors.$backgroundNeutralLight, Colors.$backgroundNeutralMedium]}
        positions={[0.2, 0.6]}
        opacity={mainBlur}
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
            scrimStyle,
            {
              width: W,
              height: H,
            },
          ]}
        >
          <Button
            onPress={close}
            style={{ position: 'absolute', left: 16, top: insets.top + 16, zIndex: 20 }}
          >
            <X size={20} />
          </Button>
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16} // ~60fps updates
            style={[{ paddingBottom: insets.bottom + 20 }]}
            contentContainerStyle={[{ paddingTop: travelDistance, paddingBottom: travelDistance }]}
            stickyHeaderIndices={[1]}
          >
            <Animated.View style={[{ aspectRatio: 5 / 7 }, cardTransition, cardScrollTransition]}>
              <Image
                style={[
                  {
                    width: W * 0.8,
                    top: (W * 0.1) / (5 / 7),
                    aspectRatio: 5 / 7,
                    alignSelf: 'center',
                  },
                ]}
                source={[
                  { uri: image, cacheKey: cardId, width: W * 0.8, height: (W * 0.8) / (5 / 7) },
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
                transition={200}
                contentFit="cover"
                onLoadStart={handleImageLoadStart}
                onLoad={handleImageLoad}
              />
            </Animated.View>
            <BlurGradientBackground
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              colors={[
                Colors.$backgroundNeutralLight,
                Colors.$backgroundNeutralLight,
                Colors.$backgroundNeutralLight,
                Colors.$backgroundNeutralLight,
              ]}
              backgroundOpacity={titleOpacity}
              positions={[0.2, 0.5, 0.9, 1]}
              opacity={titleBlur}
              blurStyle={{
                marginBottom: 32,
              }}
            >
              <View
                style={{
                  paddingTop: TITLE_SPACING,
                  paddingBottom: 12,
                }}
              >
                {title}
              </View>
            </BlurGradientBackground>

            <Animated.View style={[{ position: 'relative' }]}>{children}</Animated.View>
          </Animated.ScrollView>
        </Animated.View>
      </BlurGradientBackground>
    </Animated.View>
  )
}
