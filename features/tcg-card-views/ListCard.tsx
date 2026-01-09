import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import { ImageProxyOpts, useImageProxy } from '@/client/image-proxy'
import { CARD_ASPECT_RATIO } from '@/components/consts'
import { Text } from '@/components/ui/text'
import { formatLabel, formatPrice } from '@/components/utils'
import { ItemKinds, TCard } from '@/constants/types'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { cn } from '@/lib/utils/cn'
import { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Assets, Button, Colors } from 'react-native-ui-lib'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../../components/tcg-card/consts'
import { LiquidGlassCard } from '../../components/tcg-card/GlassCard'
import { getDefaultPrice, useNavigateToItem } from '../../components/tcg-card/helpers'
import { LoadingImagePlaceholder } from '../../components/tcg-card/placeholders'

type ItemListingProps = {
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
  className?: string
}

export type ItemListViewProps = ItemListingProps & {
  renderAccessories?: (props: ItemListViewProps) => ReactNode
}

export type CardItemListProps = Omit<ItemListViewProps, 'item' | 'displayData'>

const DefaultAccessories = ({ kind, item, displayData }: ItemListViewProps) => {
  const toggleWishList = useToggleWishlist('card')

  const { data: wishlistedIds } = useIsWishlisted('card', [item.id])
  const isWishlisted = [...wishlistedIds?.values()].some((i) => i === item.id)

  return (
    <View className="self-stretch flex-1 flex flex-col items-stretch justify-between pr-4">
      <View className="flex-1 flex flex-col justify-start">
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
          outline={!isWishlisted}
          onPress={() => {
            toggleWishList.mutate({
              kind: kind ?? 'card',
              id: item.id,
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
          outline={true}
        />
      </View>
    </View>
  )
}

const getPriceFix = (card: Partial<CollectionItemQueryView> & TCard) => {
  let price = card.collection_item_value
  if (price) return price

  if (!card.price_key) return undefined

  const priceKey = card.price_key.replace(/(\d+)(?:\.(\d))?/g, (_match, intPart, fracPart) =>
    !fracPart || fracPart === '0' ? intPart : `${intPart}_${fracPart}`
  )

  const gradePrice = card.grades_prices as Record<string, number>

  if (priceKey in gradePrice) return gradePrice[priceKey]
  return undefined
}

export function CardListView({
  card,
  ...props
}: { card: TCard & Partial<CollectionItemQueryView> } & Omit<
  ItemListViewProps,
  'item' | 'displayData'
>) {
  const displayPriceFix = getPriceFix(card)
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
    displayPrice: displayPriceFix ?? displayPrice,
    metadata: card.price_key,
  }
  return <ItemListView item={card} displayData={displayData} {...props} />
}

export function ItemListView({ renderAccessories, ...props }: ItemListViewProps) {
  const { item, kind = 'card', displayData, expanded = true, isLoading = false, className } = props

  const { data: thumbnailImg, isLoading: isImageLoading } = useImageProxy({
    variant: 'tiny',
    ...displayData.imageProxyArgs,
  })

  const { cardElement, handlePress } = useNavigateToItem(kind, item)

  return (
    <Pressable onPress={() => handlePress()}>
      <View className={cn('flex flex-row items-start w-full', className)}>
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
          <View className="flex flex-col h-full items-start p-4 pr-0 flex-1 pt-2">
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
            </View>

            {renderAccessories ? renderAccessories(props) : <DefaultAccessories {...props} />}
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
