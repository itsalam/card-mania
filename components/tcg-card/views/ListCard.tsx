import { useImageProxy } from '@/client/image-proxy'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { useOverlay } from '@/features/overlay/provider'
import { measureInWindowAsync } from '@/features/overlay/utils'
import { cn } from '@/lib/utils/cn'
import { useStores } from '@/store/provider'
import { router } from 'expo-router'
import { useRef } from 'react'
import { Pressable, View } from 'react-native'
import { LiquidGlassCard } from '../GlassCard'
import { LoadingImagePlaceholder } from '../placeholders'

export function ListCard({
  card,
  expanded = true,
  isLoading = false,
  className,
}: {
  card: TCard
  expanded?: boolean
  isLoading?: boolean
  className?: string
}) {
  const {
    data: image,
    isLoading: isImageLoading,
    status,
    ...imgProxyRest
  } = useImageProxy({
    variant: 'thumb',
    shape: 'card',
    cardId: card?.id ?? undefined,
    kind: 'front',
    queryHash: card?.image?.query_hash ?? undefined,
  })

  const { setPrefetchData } = useStores().cardStore.getInitialState()
  const cardElement = useRef<typeof Card>(null)
  const { hiddenId, setHiddenId } = useOverlay()

  const handlePress = () => {
    const positionPromise = measureInWindowAsync(cardElement as unknown as React.RefObject<View>)
    setPrefetchData(card.id, card)
    positionPromise.then((position) => {
      setHiddenId(card.id)
      router.navigate({
        pathname: `/cards/[card]`,
        params: { from: JSON.stringify(position), card: card.id },
      })
    })
  }

  const displayPrice = card?.latest_price ?? card?.grades_prices['ungraded']
  return (
    <Pressable onPress={() => handlePress()}>
      <View className={cn(className)}>
        <LiquidGlassCard
          onPress={() => handlePress()}
          variant="primary"
          className="p-0 aspect-[5/7] flex items-center justify-center overflow-hidden"
          style={{ width: 96, aspectRatio: 5 / 7 }}
          ref={cardElement}
        >
          <LoadingImagePlaceholder
            source={{ uri: image, cacheKey: card?.id }}
            isLoading={true || isImageLoading}
          />
        </LiquidGlassCard>
        {expanded && (
          <View className="flex flex-col gap-1 h-full items-start py-2 flex-1 px-2">
            <View>
              <Text className="text-base text-muted-foreground pb-1 capitalize">
                {card?.set_name}
              </Text>
              <Text className="text-lg font-bold text-wrap leading-none">{card?.name}</Text>
            </View>

            <View className="self-stretch flex-1 flex flex-row items-start justify-between">
              <View className="items-start">
                {displayPrice ? (
                  <Text className="text-3xl font-bold">{formatPrice(displayPrice)}</Text>
                ) : (
                  <Text className="text-3xl font-medium text-muted-foreground opacity-70">
                    $0.00-
                  </Text>
                )}
                <Text className="text-xs text-muted-foreground text-right">
                  Quantity: {card?.quantity ?? 0}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  )
}
