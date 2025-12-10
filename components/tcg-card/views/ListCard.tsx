import { useToggleWishlist } from '@/client/card/wishlist'
import { ImageProxyOpts, useImageProxy } from '@/client/image-proxy'
import { CARD_ASPECT_RATIO } from '@/components/consts'
import { Text } from '@/components/ui/text'
import { formatLabel, formatPrice } from '@/components/utils'
import { ItemKinds, TCard } from '@/constants/types'
import { cn } from '@/lib/utils/cn'
import { Pressable, StyleSheet, View } from 'react-native'
import { Assets, Button, Colors } from 'react-native-ui-lib'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../consts'
import { LiquidGlassCard } from '../GlassCard'
import { getDefaultPrice, useNavigateToItem } from '../helpers'
import { LoadingImagePlaceholder } from '../placeholders'

type ItemListingProps = {
  item: { id: string }
  kind?: ItemKinds
  displayData: {
    title: string
    subHeading?: string
    displayPrice?: number
    imageProxyArgs: ImageProxyOpts
  }
  expanded?: boolean
  isLoading?: boolean
  isWishlisted?: boolean
  className?: string
}

export function CardListView({
  card,
  ...props
}: { card: TCard } & Omit<ItemListingProps, 'item' | 'displayData'>) {
  const [, displayPrice] = getDefaultPrice(card)
  const displayData = {
    title: card.name,
    subHeading: card.set_name,
    imageProxyArgs: {
      variant: 'tiny',
      shape: 'card',
      cardId: card?.id ?? undefined,
      imageType: 'front',
      queryHash: card?.image?.query_hash ?? undefined,
    } as ImageProxyOpts,
    displayPrice,
  }
  return <ItemListView item={card} displayData={displayData} {...props} />
}

export function ItemListView({
  item,
  kind = 'card',
  displayData,
  expanded = true,
  isLoading = false,
  isWishlisted = false,
  className,
}: {
  item: { id: string }
  kind?: ItemKinds
  displayData: {
    title: string
    subHeading?: string
    metadata?: string
    displayPrice?: number
    imageProxyArgs: ImageProxyOpts
  }
  expanded?: boolean
  isLoading?: boolean
  isWishlisted?: boolean
  className?: string
}) {
  // const {
  //   data: thumbnailImg,
  //   isLoading: isImageLoading,
  //   status,
  // } = useImageProxy({
  //   variant: 'tiny',
  //   shape: 'card',
  //   cardId: card?.id ?? undefined,
  //   imageType: 'front',
  //   queryHash: card?.image?.query_hash ?? undefined,
  // })

  const {
    data: thumbnailImg,
    isLoading: isImageLoading,
    status,
  } = useImageProxy({ variant: 'tiny', ...displayData.imageProxyArgs })

  const toggleWishList = useToggleWishlist('card')

  const { cardElement, handlePress } = useNavigateToItem(kind, item)
  // const [,displayPrice] = getDefaultPrice(card)

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
              cacheKey: `${item?.id}-thumb`,
              width: THUMBNAIL_WIDTH,
              height: THUMBNAIL_HEIGHT,
            }}
            isLoading={isLoading || isImageLoading}
          />
        </LiquidGlassCard>
        {expanded && (
          <View className="flex flex-col h-full items-start p-4 flex-1 pt-2">
            <View>
              <Text
                variant={'large'}
                className="font-bold text-wrap leading-none"
                style={{
                  color: Colors.$textDefault,
                }}
              >
                {displayData?.title}
              </Text>
              <Text
                variant={'muted'}
                className="text-base capitalize"
                style={{
                  color: Colors.$textNeutral,
                }}
              >
                {displayData?.subHeading}
              </Text>
              {displayData?.metadata && (
                <Text
                  className="text-base uppercase font-spaceMono"
                  style={{
                    color: Colors.$textNeutralLight,
                  }}
                >
                  {formatLabel(displayData?.metadata)}
                </Text>
              )}
            </View>

            <View className="self-stretch flex-1 flex flex-row items-stretch justify-between">
              <View className="flex-1 flex flex-col justify-start">
                {displayData.displayPrice ? (
                  <Text
                    className="text-3xl font-bold"
                    style={{
                      color: Colors.$textDefault,
                    }}
                  >
                    {formatPrice(displayData.displayPrice)}
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
                      kind,
                      id: item.id,
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
