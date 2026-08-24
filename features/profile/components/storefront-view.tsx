import { useIsWishlisted, useToggleWishlist } from '@/client/card/wishlist'
import { CollectionItem, CollectionLike } from '@/client/collections/types'
import { THUMBNAIL_HEIGHT } from '@/components/tcg-card/consts'
import { useNavigateToItem } from '@/components/tcg-card/helpers'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Text } from '@/components/ui/text/base-text'
import { TCard } from '@/constants/types'
import { useAddToCart, useCartItems, useClearCart } from '@/features/cart/hooks'
import { CollectionInfo } from '@/features/collection/components/CollectionInfo'
import { useGetCollection, useGetCollectionItems } from '@/features/collection/hooks'
import { CardListView, MainInfoAccessories } from '@/features/tcg-card-views/ListCard'
import { ItemListViewProps } from '@/features/tcg-card-views/types'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { EllipsisVertical, Heart, ShoppingCart } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { BorderRadiuses, Colors, TouchableOpacity } from 'react-native-ui-lib'

type CollectionPreviewProps = { collectionId?: string; isOwnProfile?: boolean }

export function StorefrontView({ collectionId, isOwnProfile }: CollectionPreviewProps) {
  const { data: collection } = useGetCollection({ collectionId })
  return (
    <View
      style={{
        backgroundColor: Colors.$backgroundElevatedLight,
        borderRadius: BorderRadiuses.br60,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: Colors.$outlineNeutral,
      }}
    >
      <CollectionInfo collectionId={collectionId} />
      {collection && <StorefrontPreviewItems collection={collection} isOwnProfile={isOwnProfile} />}
    </View>
  )
}

type CollectionPreviewItemProps = { collection: CollectionLike; isOwnProfile?: boolean }

function StorefrontPreviewItems({ collection, isOwnProfile }: CollectionPreviewItemProps) {
  const { query } = useGetCollectionItems({ collectionId: collection?.id }, undefined, false)
  const { data, isPending } = query
  const flatData = data?.pages.flat() ?? []

  if (!isPending && flatData.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
        <Text variant="default" style={{ color: Colors.$textNeutralLight, textAlign: 'center' }}>
          No items in this collection.
        </Text>
      </View>
    )
  }

  return (
    <View style={{ gap: 18, paddingTop: 18, paddingBottom: 20 }}>
      {flatData.map((collectionItem, index) => {
        const graded = collectionItem?.price_key !== 'ungraded'
        const isLast = index === flatData.length - 1
        return (
          <View
            key={collectionItem.collection_item_id}
            style={{ position: 'relative', paddingHorizontal: 12 }}
          >
            <View
              style={{
                position: 'absolute',
                left: 4,
                top: THUMBNAIL_HEIGHT,
                bottom: 0,
                width: 3,
                marginTop: 8,
                marginBottom: 20,
                backgroundColor: Colors.$outlineNeutral,
                opacity: 0.7,
                borderRadius: 999,
              }}
            />
            {isLast && (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 0,
                  backgroundColor: Colors.$outlineNeutral,
                }}
              />
            )}
            <CardListView
              itemId={collectionItem.ref_id}
              collectionItem={{ ...collectionItem, id: collectionItem.collection_item_id }}
              cardContainerStyle={
                graded
                  ? {
                      paddingVertical: 8,
                      paddingHorizontal: 2,
                      backgroundColor: Colors.$backgroundElevatedLight,
                    }
                  : {
                      paddingVertical: 8,
                      paddingHorizontal: 2,
                    }
              }
              style={{ padding: 8 }}
              card={collectionItem}
              expanded={true}
              navigateTo="/profile/[shop-item]"
              renderAccessories={
                isOwnProfile ? undefined : (props) => <StorefrontAccessories {...props} />
              }
            />
          </View>
        )
      })}
    </View>
  )
}

function StorefrontAccessories(props: ItemListViewProps) {
  const { item, collectionItem, displayData, kind } = props
  const [menuOpen, setMenuOpen] = useState(false)

  const addToCart = useAddToCart()
  const cartItems = useCartItems()
  const clearCart = useClearCart()
  const toggleWishlist = useToggleWishlist('card')
  const { data: wishlistedIds } = useIsWishlisted('card', item ? [item.id] : [])
  const isWishlisted = [...(wishlistedIds?.values() ?? [])].some((id) => id === item?.id)
  const { handlePress: goToCard } = useNavigateToItem({
    kind: kind ?? 'card',
    item,
    path: '/cards/[card]',
    // Already resolved here (displayData is passed down from the list render) — hand it
    // off so DetailCardView shows the preferred photo immediately instead of the vendor
    // card image while its own usePrimaryPhoto fetch is in flight.
    params: displayData?.imageProxyArgs.imageId
      ? { image: displayData.imageProxyArgs.imageId }
      : undefined,
  })

  const handleAddToCart = () => {
    if (!collectionItem) return

    const doAdd = () =>
      addToCart({
        data: collectionItem as unknown as CollectionItem,
        cart: {
          price: displayData?.displayPrice ?? 0,
          originalPrice: displayData?.displayPrice ?? 0,
          quantity: 1,
          maxQuantity: (collectionItem as any).quantity ?? 1,
        },
      })

    const newSellerId = collectionItem.user_id
    const existingSellerId = cartItems.find((i) => i.data.user_id)?.data.user_id

    if (existingSellerId && newSellerId && existingSellerId !== newSellerId) {
      Alert.alert(
        'Replace cart?',
        'You have an ongoing offer with another seller. Adding items from this seller will clear your current cart.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Add',
            style: 'destructive',
            onPress: () => {
              clearCart()
              doAdd()
            },
          },
        ]
      )
      return
    }

    doAdd()
  }

  const handleWishlist = () => {
    if (!item) return
    toggleWishlist.mutate({
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
    setMenuOpen(false)
  }

  return (
    <View
      className="self-stretch flex-1 flex flex-col items-stretch justify-between px-4 relative"
      style={{ position: 'relative', alignSelf: 'stretch' }}
    >
      {/* Price + metadata — mirrors DefaultAccessories layout */}
      <MainInfoAccessories {...props} />

      {/* Buttons: ellipsis (icon) + labeled cart */}
      <View style={storefrontStyles.buttons}>
        <TouchableOpacity style={storefrontStyles.iconButton} onPress={() => setMenuOpen(true)}>
          <EllipsisVertical size={24} color={Colors.$iconGeneral} />
        </TouchableOpacity>
        <Button shape="rounded">
          <ShoppingCart size={16} color={Colors.$iconGeneral} />
          <Text style={storefrontStyles.cartLabel}>Add to Cart</Text>
        </Button>
      </View>

      <Modal visible={menuOpen} onDismiss={() => setMenuOpen(false)}>
        <View style={storefrontStyles.menu}>
          <TouchableOpacity
            style={storefrontStyles.menuItem}
            onPress={() => {
              setMenuOpen(false)
              goToCard()
            }}
          >
            <Text variant="default">View card details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={storefrontStyles.menuItem} onPress={handleWishlist}>
            <Heart
              size={18}
              fill={isWishlisted ? Colors.$iconGeneral : 'transparent'}
              color={Colors.$iconGeneral}
              style={{ marginRight: 8 }}
            />
            <Text variant="default">
              {isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const storefrontStyles = StyleSheet.create({
  priceSection: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  priceContainer: {
    flexDirection: 'row',
    gap: 4,
    flexGrow: 0,
    flexShrink: 1,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  buttons: {
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-end',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.rgba(Colors.$backgroundElevatedLight, 0.3),
    borderWidth: 1,
    borderColor: Colors.$outlineGeneral,
  },
  cartLabel: {
    fontSize: 12,
    color: Colors.$textDefault,
    fontWeight: '600',
  },
  menu: {
    width: '100%',
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
})

export function StorefrontCardItem({ item }: { item: CollectionItemQueryView & TCard }) {
  const graded = item?.price_key !== 'ungraded'
  return (
    <CardListView
      itemId={item.id}
      cardContainerStyle={
        graded
          ? {
              paddingVertical: 8,
              paddingHorizontal: 2,
              backgroundColor: Colors.$backgroundElevatedLight,
            }
          : {
              paddingVertical: 8,
              paddingHorizontal: 2,
            }
      }
      style={{ padding: 8 }}
      card={item}
      expanded={true}
      navigateTo="/profile/[shop-item]"
    />
  )
}
