import { useCardQuery } from '@/client/card'
import { BlurBackground } from '@/components/Background'
import PriceGraph from '@/components/graphs/PriceGraph'
import { GraphInputKey } from '@/components/graphs/ui/types'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { useInvalidateOnFocus } from '@/components/tcg-card/helpers'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { chunk, formatLabel, formatPrice, splitToNChunks } from '@/components/utils'
import { qk } from '@/lib/store/functions/helpers'
import { Image } from 'expo-image'
import { Eye, EyeOff, Plus, Undo2, X } from 'lucide-react-native'
import { SafeAreaView } from 'moti'
import React, { useMemo, useState } from 'react'
import { Dimensions, FlatList, Pressable, ScrollView, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Colors, Dialog, PanningProvider } from 'react-native-ui-lib'
import Carousel from 'react-native-ui-lib/carousel'
import { AddToCollectionsView } from './footer/add-to-collections'
import { CreateCollectionView } from './footer/create-collections'
import { Footer } from './footer/footer'
import { useSelectedGrades, useTransitionAnimation } from './helpers'
import { CardDetailsProvider } from './provider'
import { Attribute, CardScreenHeader } from './ui'

export default function FocusCardView({
  cardId,
  baseImage,
  animateFrom,
}: {
  cardId: string
  baseImage?: string
  animateFrom: { x: number; y: number; width: number; height: number }
}) {
  const { data: cardData } = useCardQuery(cardId)
  const { cardStyle, scrimStyle, close } = useTransitionAnimation(animateFrom)

  const finalImage = baseImage || cardData?.image?.url || ''
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

  const [images, setImages] = useState([finalImage])

  useInvalidateOnFocus(qk.recent)

  const insets = useSafeAreaInsets()
  const { width: W, height: H } = Dimensions.get('window')
  const container = useAnimatedStyle(() => ({
    width: W,
    height: H,
    position: 'absolute',
  }))

  const handleClose = () => {
    close()
  }

  const NUM_PRICE_ROWS = 2
  const rows = useMemo(
    () =>
      splitToNChunks(
        prices.filter(([key]) => visibleGrades.includes(key)),
        NUM_PRICE_ROWS
      ).filter((r) => r.length > 0),
    [prices, visibleGrades]
  )

  const Prices = (
    <ScrollView
      horizontal
      bounces={false}
      showsHorizontalScrollIndicator={true}
      alwaysBounceVertical={true}
      className="overflow-visible p-4"
      style={{ alignSelf: 'stretch', maxHeight: 200, flexGrow: 0, flexShrink: 0 }}
      contentContainerClassName="flex gap-2 flex-col"
    >
      {rows.map((row, i) => (
        <View key={`row-${i}`} className={'flex flex-row gap-2 overflow-visible pr-4'}>
          {row.map(([key, value]) => {
            return (
              <LiquidGlassCard
                className="flex items-center justify-center"
                style={{ opacity: value ? 1 : 0.5, minWidth: 100 }}
                size="sm"
                key={`${key}-${value}-${i}`}
                onPress={() => {
                  setSelectedGrades((prev) =>
                    prev.includes(key) ? prev.filter((grade) => grade !== key) : [...prev, key]
                  )
                }}
              >
                <View className="flex flex-row gap-2 items-center justify-end">
                  {selectedGrades.includes(key) ? <Eye size={16} /> : <EyeOff size={16} />}
                  <Text className="text-lg font-bold text-muted-foreground text-nowrap text-right font-spaceMono">
                    {formatLabel(key)}
                  </Text>
                </View>
                <Text className="text-3xl capitalize text-nowrap text-right">
                  {value ? formatPrice(value) : '--'}
                </Text>
              </LiquidGlassCard>
            )
          })}
          {rows.length === i + 1 && (
            <LiquidGlassCard
              className="flex items-center justify-center"
              style={{ aspectRatio: 1 }}
              size="sm"
              onPress={() => setShowMoreGrades(!showMoreGrades)}
            >
              <Plus size={28} />
            </LiquidGlassCard>
          )}
        </View>
      ))}
    </ScrollView>
  )

  return (
    <CardDetailsProvider
      card={cardData}
      footerPages={[
        { title: 'Add to Collection', page: AddToCollectionsView },
        { title: 'Create Collection', page: CreateCollectionView },
      ]}
    >
      <Animated.View style={cardStyle}>
        <Image
          style={{ width: '100%', aspectRatio: 5 / 7 }}
          source={{ uri: finalImage, cacheKey: cardId }}
          cachePolicy="memory-disk"
          transition={0}
          contentFit="cover"
        />
      </Animated.View>
      <Animated.View style={[scrimStyle, container]}>
        <BlurBackground opacity={[1.0, 0.7]} start={{ x: 0.5, y: 0.5 }} end={{ x: 0.5, y: 0 }}>
          <Pressable
            onPress={handleClose}
            style={{ position: 'absolute', right: 16, top: insets.top + 16, zIndex: 20 }}
          >
            <X size={20} />
          </Pressable>
          <SafeAreaView className="overflow-visible" style={{ width: W }}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              className="h-full overflow-visible"
              contentContainerClassName="flex flex-col items-start justify-stretch gap-4 pt-4"
            >
              <CardScreenHeader title={'Overview'} />
              <View className="px-8 flex flex-col items-start justify-stretch gap-4 w-full">
                <View>
                  <Heading size="4xl">{cardData?.name}</Heading>
                  <Heading className="font-spaceMono font-bold" size="xl">
                    {cardData?.set_name}
                  </Heading>
                </View>

                <View className="w-full py-4">
                  <View
                    style={{
                      minHeight: (W * 0.4 * 7) / 5,
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
                        source={{ uri: finalImage, cacheKey: cardId }}
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
                {Prices}

                <PriceGraph<Record<string, string | number>>
                  xKey={'date' as GraphInputKey<typeof priceChartingData>}
                  yKeys={selectedGrades}
                  data={priceChartingData?.priceData}
                />
              </View>

              <View className="pt-4 flex flex-col items-start justify-stretch gap-2 w-full">
                <CardScreenHeader title={'Offers'} />
              </View>
            </ScrollView>
          </SafeAreaView>
        </BlurBackground>
      </Animated.View>

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
