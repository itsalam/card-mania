import { ViewParams } from '@/client/card/types'
import { useToggleWishlist } from '@/client/card/wishlist'
import { useImageProxy } from '@/client/image-proxy'
import { CARD_ASPECT_RATIO } from '@/components/consts'
import { Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { cn } from '@/lib/utils/cn'
import { Pressable, StyleSheet, View } from 'react-native'
import { Assets, Button, Colors } from 'react-native-ui-lib'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../consts'
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
    data: thumbnailImg,
    isLoading: isImageLoading,
    status,
  } = useImageProxy({
    variant: 'tiny',
    shape: 'card',
    cardId: card?.id ?? undefined,
    kind: 'front',
    queryHash: card?.image?.query_hash ?? undefined,
  })

  const toggleWishList = useToggleWishlist('card')

  const { cardElement, handlePress } = useNavigateToDetailCard(card, () => {})
  const [grade, displayPrice] = getDefaultPrice(card)
  return (
    <Pressable onPress={() => handlePress()}>
      <View className={cn('flex flex-row items-center w-full', className)}>
        <LiquidGlassCard
          onPress={() => handlePress()}
          ref={cardElement}
          variant="primary"
          className="p-0 aspect-[5/7] flex items-center justify-center overflow-hidden"
          style={{ width: THUMBNAIL_WIDTH, aspectRatio: CARD_ASPECT_RATIO }}
        >
          <LoadingImagePlaceholder
            source={{
              uri: thumbnailImg,
              cacheKey: `${card?.id}-thumb`,
              width: THUMBNAIL_WIDTH,
              height: THUMBNAIL_HEIGHT,
            }}
            isLoading={isLoading || isImageLoading}
          />
        </LiquidGlassCard>
        {expanded && (
          <View className="flex flex-col gap-1 h-full items-start p-4 flex-1 pt-2">
            <View>
              <Text
                className="text-base pb-1 capitalize"
                style={{
                  color: Colors.$textNeutral,
                }}
              >
                {card?.set_name}
              </Text>
              <Text
                className="text-lg font-bold text-wrap leading-none"
                style={{
                  color: Colors.$textDefault,
                }}
              >
                {card?.name}
              </Text>
            </View>

            <View className="self-stretch flex-1 flex flex-row items-stretch justify-between">
              <View className="flex-1 flex flex-col justify-start">
                {displayPrice ? (
                  <Text
                    className="text-3xl font-bold"
                    style={{
                      color: Colors.$textDefault,
                    }}
                  >
                    {formatPrice(displayPrice)}
                  </Text>
                ) : (
                  <Text
                    className="text-3xl font-medium opacity-70"
                    style={{
                      color: Colors.$textDefault,
                    }}
                  >
                    $0.00-
                  </Text>
                )}
              </View>

              <View className="flex flex-row gap-1 items-end justify-end">
                <Button
                  outline={isWishlisted}
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
                  // outlineColor={Colors.$iconDefault}
                  // backgroundColor={Colors.$iconDefault}
                />
                <Button
                  size="small"
                  round
                  outlineWidth={1.5}
                  iconStyle={styles.buttonIcon}
                  style={styles.button}
                  iconSource={Assets.icons.Folder}
                  outline={true}
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
