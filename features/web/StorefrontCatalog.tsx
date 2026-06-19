import { CollectionLike } from '@/client/collections/types'
import { useToast } from '@/components/Toast'
import { SearchBar } from '@/components/ui/search'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { TCard } from '@/constants/types'
import { useGetCollectionItems } from '@/features/collection/hooks'
import { CardListView } from '@/features/tcg-card-views/ListCard'
import { ItemListViewProps } from '@/features/tcg-card-views/types'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { useCartStore } from '@/lib/store/useCartStore'
import { ShoppingCart } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'

type SortOrder = 'price_asc' | 'price_desc' | 'newest'

type StorefrontCatalogProps = {
  collectionId: string | null
  collections: CollectionLike[]
  searchQuery: string
  onSearchChange: (q: string) => void
  paddingTop?: number
}

export function StorefrontCatalog({
  collectionId,
  collections,
  searchQuery,
  onSearchChange,
  paddingTop = 24,
}: StorefrontCatalogProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const { width } = useWindowDimensions()
  const isPortrait = width < 768

  const targetCollections = collectionId
    ? collections.filter((c) => c.id === collectionId)
    : collections

  return (
    <View style={{ flex: 1, paddingHorizontal: 8, paddingBottom: 24, paddingTop, gap: 16 }}>
      {/* Sort + search bar */}
      <View
        style={{
          flexDirection: isPortrait ? 'column' : 'row',
          gap: isPortrait ? 8 : 12,
          alignItems: isPortrait ? 'stretch' : 'center',
        }}
      >
        <SortToggle isPortrait={isPortrait} current={sortOrder} onChange={setSortOrder} />
        <SearchBar
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search cards…"
          hideSideButton
          style={isPortrait ? undefined : { flex: 1, maxWidth: 320 }}
        />
      </View>

      {/* Shared grid — each CollectionGrid is a subgrid row spanning all columns */}
      {targetCollections.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <Text variant="muted">No storefront collections yet.</Text>
        </View>
      ) : (
        <View
          className="grid"
          style={
            {
              gridTemplateColumns: 'repeat(auto-fit, minmax(188px, 1fr))',
              columnGap: 10,
              rowGap: 24,
            } as any
          }
        >
          {targetCollections.map((col) => (
            <CollectionGrid
              key={col.id}
              collectionId={col.id!}
              collectionName={col.name ?? 'Untitled'}
              searchQuery={searchQuery}
              sortOrder={sortOrder}
              showName={!collectionId}
            />
          ))}
        </View>
      )}
    </View>
  )
}

type CollectionGridProps = {
  collectionId: string
  collectionName: string
  searchQuery: string
  sortOrder: SortOrder
  showName: boolean
}

function CollectionGrid({
  collectionId,
  collectionName,
  searchQuery,
  sortOrder,
  showName,
}: CollectionGridProps) {
  const { query } = useGetCollectionItems({ collectionId }, undefined, false)
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = query
  const { addItem, items: cartItems } = useCartStore()
  const { showToast } = useToast()

  function handleAddToCart(item: CollectionItemQueryView & TCard) {
    addItem({
      data: { ...item, id: item.collection_item_id } as any,
      cart: {
        price: Math.round((item.latest_price ?? 0) * 100),
        originalPrice: Math.round((item.latest_price ?? 0) * 100),
        quantity: 1,
        maxQuantity: item.quantity ?? 1,
      },
    })
    showToast({ message: `${item.name ?? 'Card'} added to cart` })
  }

  const flatData = (data?.pages.flat() ?? []) as (CollectionItemQueryView & TCard)[]

  const filtered = flatData
    .filter((item) => {
      if (!searchQuery) return true
      return item.name?.toLowerCase().includes(searchQuery.toLowerCase())
    })
    .sort((a, b) => {
      if (sortOrder === 'price_asc') return (a.latest_price ?? 0) - (b.latest_price ?? 0)
      if (sortOrder === 'price_desc') return (b.latest_price ?? 0) - (a.latest_price ?? 0)
      // newest: sort by collection_item_id descending (proxy for insertion order)
      return (b.collection_item_id ?? '').localeCompare(a.collection_item_id ?? '')
    })

  if (isPending) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center', gridColumn: '1 / -1' } as any}>
        <ActivityIndicator />
      </View>
    )
  }

  if (filtered.length === 0) {
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center', gridColumn: '1 / -1' } as any}>
        <Text variant="muted">No cards found.</Text>
      </View>
    )
  }

  return (
    <View
      style={
        {
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'subgrid',
          rowGap: 10,
        } as any
      }
    >
      {showName && (
        <Text variant="h3" style={{ marginBottom: 4, gridColumn: '1 / -1' } as any}>
          {collectionName}
        </Text>
      )}
      {filtered.map((item) => {
        const inCart = cartItems.some((c) => c.data.id === item.collection_item_id)
        return (
          <View
            key={item.collection_item_id}
            style={{
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: Colors.$backgroundElevated,
              borderWidth: 1,
              borderColor: Colors.$outlineDefault,
              maxWidth: 320,
              marginHorizontal: 'auto' as any,
              width: '100%',
            }}
          >
            <CardListView
              card={item}
              collectionItem={{ ...item, id: item.collection_item_id }}
              vertical={true}
              expanded={true}
              onPress={() => handleAddToCart(item)}
              imageAccessory={
                <View
                  style={{
                    aspectRatio: 1,
                    borderRadius: 999,
                    backgroundColor: Colors.rgba(
                      inCart ? Colors.$backgroundPrimaryHeavy : Colors.$backgroundNeutralHeavy,
                      0.85
                    ),
                    position: 'absolute',
                    left: 6,
                    bottom: 6,
                    padding: 5,
                  }}
                >
                  <ShoppingCart size={14} color={inCart ? '#fff' : Colors.$iconNeutralLight} />
                </View>
              }
              renderAccessories={(props) => <GridTileInfo {...props} />}
            />
          </View>
        )
      })}
      {hasNextPage && (
        <Pressable
          onPress={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          style={
            {
              gridColumn: '1 / -1',
              justifySelf: 'center',
              paddingVertical: 10,
              paddingHorizontal: 24,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: Colors.$outlineNeutral,
              marginTop: 8,
            } as any
          }
        >
          <Text variant="default">{isFetchingNextPage ? 'Loading…' : 'Load more'}</Text>
        </Pressable>
      )}
    </View>
  )
}

function GridTileInfo({ displayData }: ItemListViewProps) {
  return (
    <View style={{ padding: 10, gap: 0, overflow: 'hidden', minWidth: 0 }}>
      <Text
        numberOfLines={2}
        style={{ color: Colors.$textDefault, fontWeight: '600', flexShrink: 1 }}
      >
        {displayData?.title ?? '—'}
      </Text>
      {displayData?.subHeading ? (
        <Text
          variant="small"
          className="text-xs"
          numberOfLines={2}
          style={{ color: Colors.$textNeutralLight, flexShrink: 1 }}
        >
          {displayData.subHeading}
        </Text>
      ) : null}
      <Text
        className="text-xl"
        variant="default"
        numberOfLines={1}
        style={{ color: Colors.$textDefault, fontWeight: '700', marginTop: 2 }}
      >
        {displayData?.displayPrice ? formatPrice(displayData.displayPrice) : '$-.--'}
      </Text>
    </View>
  )
}

type SortToggleProps = { current: SortOrder; onChange: (s: SortOrder) => void; isPortrait: boolean }

function SortToggle({ current, onChange, isPortrait }: SortToggleProps) {
  const options: { value: SortOrder; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'price_asc', label: 'Price ↑' },
    { value: 'price_desc', label: 'Price ↓' },
  ]

  return (
    <View
      style={{
        alignSelf: isPortrait ? 'baseline' : 'auto',
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: Colors.$outlineNeutral,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: current === opt.value ? Colors.$backgroundPrimaryHeavy : 'transparent',
          }}
        >
          <Text
            variant="small"
            style={{
              color: current === opt.value ? Colors.$textDefault : Colors.$textNeutralLight,
              fontWeight: current === opt.value ? '600' : '400',
            }}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
