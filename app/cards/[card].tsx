import { useCardQuery } from '@/client/card'
import { usePriceChartingDataBatch } from '@/client/chart-data'
import { BlurBackground } from '@/components/Background'
import PriceGraph from '@/components/graphs/PriceGraph'
import { WishlistedIcon } from '@/components/icons'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { formatLabel, formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { useOverlayStore } from '@/features/overlay/provider'
import { useAnimateFromPosition } from '@/features/overlay/utils'
import { useNavigation, useRoute } from '@react-navigation/native'
import { Image } from 'expo-image'
import { Eye, EyeOff, FolderHeart, Plus, ShoppingCart, Undo2, X } from 'lucide-react-native'
import { SafeAreaView } from 'moti'
import { useMemo, useState } from 'react'
import { Dimensions, FlatList, Pressable, ScrollView, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Colors, Dialog, PanningProvider } from 'react-native-ui-lib'
import Carousel from 'react-native-ui-lib/carousel'

function splitToNChunks(array: readonly any[], n: number) {
  const copy = [...array]
  let result = []
  for (let i = n; i > 0; i--) {
    result.push(copy.splice(0, Math.ceil(copy.length / i)))
  }
  return result
}

export function chunk<T>(arr: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error('size must be > 0')
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

const useSelectedGrades = (card?: Partial<TCard>, preSelectedGrades?: string[]) => {
  const [selectedGrades, setSelectedGrades] = useState<string[]>(preSelectedGrades || [])
  const { data: priceChartingData, ...priceFetchResults } = usePriceChartingDataBatch({
    card,
    grades: selectedGrades,
  })

  return { selectedGrades, setSelectedGrades, priceChartingData, priceFetchResults }
}

const Attribute = ({ label, value }: { label: string; value: string }) => {
  return (
    <View className="flex flex-col items-start justify-start">
      <Text className="text-muted-foreground text-left font-spaceMono text-sm">{label}</Text>
      <Text className="text-lg font-bold text-nowrap text-right">{value}</Text>
    </View>
  )
}

const FooterButton = ({
  icon,
  label,
  onPress,
}: {
  icon?: React.ReactNode
  label: string
  onPress: () => void
}) => {
  return (
    <Button
      className="flex-1 flex flex-row gap-2 text-white"
      style={{ color: 'white' }}
      onPress={onPress}
    >
      {icon}
      <Text className="text-white">{label}</Text>
    </Button>
  )
}

export const CardScreenHeader = (props: { title: string; backgroundColor?: string }) => {
  const { title, backgroundColor = Colors.rgba(Colors.$textPrimary, 0.8) } = props
  return (
    <View className="w-full py-1 flex flex-row items-center justify-center gap-3">
      <View style={{ backgroundColor, height: 1.5, width: 32 }} />
      <Heading style={{ color: backgroundColor }} size="lg" className="font-spaceMono">
        {title}
      </Heading>
      <View style={{ backgroundColor, height: 2, flex: 1, marginLeft: 6 }} />
    </View>
  )
}

export default function FocusCardView() {
  const route = useRoute<any>()
  const nav = useNavigation<any>()
  const {
    card: cardId,
    from,
    image,
  } = route.params as { card: string; from: string; image: string }
  const { data } = useCardQuery(cardId)
  const finalImage = image || data?.image?.url || ''
  const grades = data?.grades_prices ?? {}
  const availableGrades = useMemo(
    () =>
      Object.keys(grades || {})
        .sort()
        .reverse(),
    [grades]
  )
  const prices = useMemo(
    () => Object.entries(grades || {}).sort((a, b) => b[0].localeCompare(a[0])),
    [grades]
  )

  const [showMoreGrades, setShowMoreGrades] = useState(false)
  const [visibleGrades, setVisibleGrades] = useState<string[]>(
    prices.filter(([, value]) => !!value).map(([key]) => key)
  )

  const { selectedGrades, setSelectedGrades, priceChartingData, priceFetchResults } =
    useSelectedGrades(data, visibleGrades)

  const setHiddenId = useOverlayStore((s) => s.setHiddenId)

  const [images, setImages] = useState([finalImage])

  const insets = useSafeAreaInsets()
  const { width: W, height: H } = Dimensions.get('window')
  const container = useAnimatedStyle(() => ({
    width: W,
    height: H,
    position: 'absolute',
  }))

  const fromPos = JSON.parse(from) as { x: number; y: number; width: number; height: number }

  const { cardStyle, scrimStyle, close } = useAnimateFromPosition(fromPos, {
    onClose: () => {
      setHiddenId(undefined)
      nav.canGoBack() ? nav.goBack() : nav.getParent?.() && nav.getParent()?.goBack()
    },
  })

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

  const Footer = () => {
    return (
      <Animated.View
        className="border-2 border-b-0 border-black/20"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
      >
        <BlurBackground
          opacity={[0.1, 0.5]}
          style={{
            paddingTop: 12,
            paddingBottom: insets.bottom,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
          className="h-full w-full flex flex-row gap-2 px-4"
        >
          <FooterButton
            icon={<FolderHeart size={16} strokeWidth={2.5} color="white" />}
            label="Collection"
            onPress={() => {}}
          />
          <FooterButton
            icon={
              <WishlistedIcon
                size={20}
                strokeWidth={2.5}
                stroke="currentColor"
                style={{ stroke: 'currentColor' }}
              />
            }
            label="Wishlist"
            onPress={() => {}}
          />
          <FooterButton
            icon={<ShoppingCart size={16} strokeWidth={2.5} color="white" />}
            label="Add to Cart"
            onPress={() => {}}
          />
        </BlurBackground>
      </Animated.View>
    )
  }

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
              <Plus size={32} />
            </LiquidGlassCard>
          )}
        </View>
      ))}
    </ScrollView>
  )

  return (
    <>
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
                  <Heading size="4xl">{data?.name}</Heading>
                  <Heading className="font-spaceMono font-bold" size="xl">
                    {data?.set_name}
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
                      {data?.release_date && (
                        <Attribute
                          label="Released"
                          value={new Date(data?.release_date).toLocaleDateString()}
                        />
                      )}
                      <Attribute label="Genre" value={data?.genre || '--'} />
                      {data?.last_updated && (
                        <Attribute
                          label="Last Updated"
                          value={new Date(data?.last_updated).toLocaleDateString()}
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

                <PriceGraph
                  xKey="date"
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
        onDismiss={() => console.log('dismissed')}
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
      <Footer />
    </>
  )
}
