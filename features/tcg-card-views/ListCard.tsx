import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { formatLabel, formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { cn } from '@/lib/utils/cn'
import { EllipsisVertical, Heart, Maximize, TrendingDown, TrendingUp } from 'lucide-react-native'
import { forwardRef, ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Colors, TouchableOpacity } from 'react-native-ui-lib'
import { useNavigateToItem } from '../../components/tcg-card/helpers'
import { CardImage } from './card-image'
import { getCardDisplayData } from './helpers'
import { ItemListViewProps } from './types'

function GainBadge({ gain, value }: { gain: number; value: number }) {
  const isPositive = gain > 0
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {isPositive ? (
        <TrendingUp size={24} color={Colors.$textSuccess} />
      ) : (
        <TrendingDown size={24} color={Colors.$textDanger} />
      )}
      <View style={{ flexDirection: 'column', gap: 2 }}>
        <Text
          variant="default"
          style={{ color: isPositive ? Colors.$textSuccess : Colors.$textDanger }}
        >
          {isPositive ? '+' : ''}
          {formatPrice(value)}
        </Text>
        <Text
          variant="small"
          style={{
            color: isPositive ? Colors.$textSuccess : Colors.$textDanger,
            opacity: 0.7,
            alignSelf: 'flex-end',
          }}
        >
          {`(${gain.toFixed(1)}%)`}
        </Text>
      </View>
    </View>
  )
}

export const DefaultAccessories = ({
  renderButtons,
  ...props
}: ItemListViewProps & { renderButtons?: (props: ItemListViewProps) => ReactNode }) => {
  const { kind, item, displayData, gain } = props
  const toggleWishList = useToggleWishlist('card')

  const { data: wishlistedIds } = useIsWishlisted('card', item ? [item.id] : [])
  const isWishlisted = [...wishlistedIds?.values()].some((i) => i === item?.id)

  return (
    <View
      className="self-stretch flex-1 flex flex-col items-stretch justify-between pr-4 relative"
      style={{ position: 'relative', alignSelf: 'stretch' }}
    >
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
        <View style={[styles.priceContainer]}>
          <Text>
            {displayData?.displayPrice ? (
              <Text
                className="text-4xl font-bold"
                style={{
                  color: Colors.$textDefault,
                }}
              >
                {formatPrice(displayData.displayPrice)}
              </Text>
            ) : (
              <Text
                className="text-4xl font-medium opacity-70"
                style={{
                  color: Colors.$textDefault,
                }}
              >
                $-.--
              </Text>
            )}
            {displayData?.quantity && (
              <Text
                variant={'small'}
                className="font-medium opacity-70"
                style={{
                  color: Colors.$textNeutralHeavy,
                }}
              >
                {` x Qty: ${displayData?.quantity}`}
              </Text>
            )}
          </Text>
          {typeof gain === 'number' && gain !== 0 && displayData?.displayPrice && (
            <GainBadge gain={gain} value={gain * displayData.displayPrice} />
          )}
        </View>
      </View>
      {renderButtons ? (
        renderButtons(props)
      ) : (
        <View className="absolute right-0 bottom-0 flex gap-1 items-center flex-col justify-center">
          <TouchableOpacity style={[styles.button]}>
            <EllipsisVertical size={24} color={Colors.$iconGeneral} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              item &&
                toggleWishList.mutate({
                  kind: kind ?? 'card',
                  id: item.id,
                  card: {
                    name: displayData?.title ?? '',
                    set_name: displayData?.subHeading,
                    latest_price: displayData?.displayPrice,
                    image_url: displayData?.imageProxyArgs?.directUrl,
                    grades_prices: (item as any).grades_prices ?? undefined,
                  },
                })
            }}
            style={styles.button}
          >
            <Heart
              size={20}
              fill={isWishlisted ? Colors.$iconGeneral : 'transparent'}
              color={Colors.$iconGeneral}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

export type CardListViewProps = { card?: TCard & Partial<CollectionItemQueryView> } & Omit<
  ItemListViewProps,
  'item' | 'displayData'
>

export function CardListView({ card, collectionItem, ...props }: CardListViewProps) {
  const displayData = getCardDisplayData({
    card,
    collectionItem,
    metadata: card?.price_key ? { price_key: card?.price_key } : undefined,
    isLoading: props.isLoading,
  })

  //@ts-ignore
  return (
    <ItemListView
      item={card}
      collectionItem={collectionItem}
      displayData={displayData}
      {...props}
    />
  )
}

export const ItemListView = forwardRef<View, ItemListViewProps>(function ItemListView(
  { renderAccessories, navigateTo, ...props },
  ref
) {
  const {
    item,
    kind = 'card',
    collectionItem,
    displayData,
    expanded = true,
    className,
    vertical = false,
    style,
    onPress,
  } = props

  const { cardElement, handlePress } = useNavigateToItem({
    kind,
    item: collectionItem ? collectionItem : item,
    path: navigateTo,
    paramName: navigateTo?.match(/\[([^\]]+)\]/)?.[1],
    params: collectionItem
      ? {
          cardId: collectionItem.ref_id,
          collectionId: collectionItem.collection_id,
        }
      : undefined,
  })

  return (
    <View
      ref={ref}
      className={cn('items-start flex', vertical ? '' : 'flex-row w-full', className)}
      style={style}
    >
      <View
        style={{
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <CardImage
          displayData={displayData}
          imageProps={{ onPress: onPress ?? handlePress, ref: cardElement }}
        />
        <View
          style={{
            aspectRatio: 1,
            borderRadius: 999,
            backgroundColor: Colors.rgba(Colors.$backgroundElevatedLight, 0.8),
            position: 'absolute',
            right: 0,
            bottom: 0,
            transform: [{ translateX: '25%' }, { translateY: '25%' }],
            padding: 8,
          }}
        >
          <Maximize size={18} color={Colors.$iconDefault} />
        </View>
      </View>

      {expanded && !Boolean(vertical) ? (
        <HorizontalAccessory renderAccessories={renderAccessories} {...props} />
      ) : (
        renderAccessories?.(props)
      )}
    </View>
  )
})

function HorizontalAccessory(props: ItemListViewProps) {
  const { isLoading, displayData, renderAccessories } = props
  return (
    <View className="flex flex-col h-full w-full items-start p-4 pr-0 flex-1 pt-2">
      <View>
        {isLoading ? (
          <>
            <Skeleton style={{ height: 18, width: 190, marginBottom: 6 }} />
            <Skeleton style={{ height: 14, width: 275, marginBottom: 4 }} />
          </>
        ) : (
          <>
            <Text
              variant={'large'}
              style={{
                color: Colors.$textDefault,
              }}
            >
              {displayData?.title}
            </Text>
            <Text
              variant={'muted'}
              className="capitalize"
              style={{
                color: Colors.$textNeutral,
              }}
            >
              {displayData?.subHeading}
            </Text>
          </>
        )}
      </View>

      {renderAccessories ? renderAccessories(props) : <DefaultAccessories {...props} />}
    </View>
  )
}

const styles = StyleSheet.create({
  buttonIcon: { width: 28, height: 28 },
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  priceContainer: {
    flexDirection: 'row',
    gap: 4,

    flexGrow: 0,
    flexShrink: 1,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
})
