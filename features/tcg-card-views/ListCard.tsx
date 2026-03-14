import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { formatLabel, formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { cn } from '@/lib/utils/cn'
import { forwardRef, ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Assets, Button, Colors } from 'react-native-ui-lib'
import { useNavigateToItem } from '../../components/tcg-card/helpers'
import { CardImage } from './card-image'
import { getCardDisplayData } from './helpers'
import { ItemListViewProps } from './types'

export const DefaultAccessories = ({
  renderButtons,
  ...props
}: ItemListViewProps & { renderButtons?: (props: ItemListViewProps) => ReactNode }) => {
  const { kind, item, displayData } = props
  const toggleWishList = useToggleWishlist('card')

  const { data: wishlistedIds } = useIsWishlisted('card', item ? [item.id] : [])
  const isWishlisted = [...wishlistedIds?.values()].some((i) => i === item?.id)

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
        <Text>
          {displayData?.displayPrice ? (
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
      </View>
      {renderButtons ? (
        renderButtons(props)
      ) : (
        <View className="flex flex-row gap-1 items-end justify-end">
          <Button
            outline={!isWishlisted}
            onPress={() => {
              item &&
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
      )}
    </View>
  )
}

export function CardListView({
  card,
  collectionItem,
  ...props
}: { card?: TCard & Partial<CollectionItemQueryView> } & Omit<
  ItemListViewProps,
  'item' | 'displayData'
>) {
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
      <CardImage
        displayData={displayData}
        imageProps={{ onPress: onPress ?? handlePress, ref: cardElement }}
      />

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
  button: { width: 36, height: 36 },
})
