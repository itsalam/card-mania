import { useToggleWishlist, ViewParams } from '@/client/card/wishlist'
import { useImageProxy } from '@/client/image-proxy'
import { Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { useOverlay } from '@/features/overlay/provider'
import { cn } from '@/lib/utils/cn'
import { Pressable, StyleSheet, View } from 'react-native'
import { Assets, Button } from 'react-native-ui-lib'
import { LiquidGlassCard } from '../GlassCard'
import { getDefaultPrice, useNavigateToDetailCard } from '../helpers'
import { LoadingImagePlaceholder } from '../placeholders'

export function ListCard({
  card,
  expanded = true,
  isLoading = false,
  isWishlisted = false,
  className,
  viewParams,
}: {
  card: TCard
  expanded?: boolean
  isLoading?: boolean
  isWishlisted?: boolean
  className?: string
  viewParams?: ViewParams
}) {
  const {
    data: image,
    isLoading: isImageLoading,
    status,
  } = useImageProxy({
    variant: 'thumb',
    shape: 'card',
    cardId: card?.id ?? undefined,
    kind: 'front',
    queryHash: card?.image?.query_hash ?? undefined,
  })

  const toggleWishList = useToggleWishlist()
  const { setHiddenId } = useOverlay()

  const { cardElement, handlePress } = useNavigateToDetailCard(card, () => {
    setHiddenId(card.id)
  })

  const [grade, displayPrice] = getDefaultPrice(card)
  return (
    <Pressable onPress={() => handlePress()}>
      <View className={cn(expanded && 'flex flex-row items-center gap-2 p-2 w-full', className)}>
        <LiquidGlassCard
          onPress={() => handlePress()}
          variant="primary"
          className="p-0 aspect-[5/7] flex items-center justify-center overflow-hidden"
          style={{ width: 96, aspectRatio: 5 / 7 }}
          ref={cardElement}
        >
          <LoadingImagePlaceholder
            source={{ uri: image, cacheKey: card?.id }}
            isLoading={isLoading || isImageLoading}
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

            <View className="self-stretch flex-1 flex flex-row items-stretch justify-between">
              <View className="flex-1 flex flex-col justify-start">
                {displayPrice ? (
                  <Text className="text-3xl font-bold">{formatPrice(displayPrice)}</Text>
                ) : (
                  <Text className="text-3xl font-medium text-muted-foreground opacity-70">
                    $0.00-
                  </Text>
                )}
              </View>

              <View className="flex flex-row gap-1 items-end justify-end">
                <Button
                  outline={!isWishlisted}
                  onPress={() => {
                    toggleWishList.mutate({
                      kind: 'card',
                      id: card.id,
                      viewParams,
                      p_metadata: { grades: [grade].filter(Boolean) },
                    })
                  }}
                  iconStyle={styles.buttonIcon}
                  style={styles.button}
                  size="small"
                  round
                  outlineWidth={1.5}
                  iconSource={Assets.icons.BookmarkHeart}
                />
                <Button
                  size="small"
                  round
                  outlineWidth={1.5}
                  iconStyle={styles.buttonIcon}
                  style={styles.button}
                  iconSource={Assets.icons.Folder}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  buttonIcon: { width: 28, height: 28 },
  button: { width: 36, height: 36 },
})
