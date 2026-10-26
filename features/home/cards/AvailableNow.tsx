import { HomeFeedSectionConfig } from '@/client/home/sections'
import { getSavings, useWishlistHits, WishlistHit } from '@/client/wishlist/hits'
import { useExpandableSection } from '@/components/content-card'
import { CardTile, CardTileBadge, DEFAULT_CARD_TILE_WIDTH } from '@/components/tcg-card/CardTile'
import { CARD_LIST_ROW_PADDING, LIST_THUMBNAIL_WIDTH } from '@/components/tcg-card/consts'
import { GradeBadge } from '@/components/tcg-card/GradeBadge'
import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { useNavigateToItem } from '@/components/tcg-card/helpers'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { CardImage } from '@/features/tcg-card-views/card-image'
import { DisplayData } from '@/features/tcg-card-views/types'
import { useRouter } from 'expo-router'
import { Heart } from 'lucide-react-native'
import { useMemo } from 'react'
import { Pressable, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { HOME_FEED_SECTION_ICONS } from '../sectionIcons'

// Wishlisted cards another seller has listed (get_wishlist_hits). Price is market value at the
// listing's grade — listings have no asking price — compared with that grade's price when the
// card was wishlisted, so the "-X%" badge means "cheaper than when you wishlisted it".
//
// Design refs: Klarna's price list (refero.design/screens/b69ba734-0615-4769-bbed-9fbbc542d020)
// badges the price and pairs it with a second reference point; Target's deal cards
// (refero.design/screens/6c758c46-5199-4bbe-a6b9-05d061badcbf) badge the discount on the image
// and strike through the "was" price. Collapsed items use the shared glass CardTile (see its
// refs); expanded rows use the same glass surface as list rows.
const ITEM_WIDTH = DEFAULT_CARD_TILE_WIDTH
const IMAGE_WIDTH = LIST_THUMBNAIL_WIDTH

type HitRow = { id: string; hit?: WishlistHit }

function hitDisplayData(hit: WishlistHit): DisplayData {
  return {
    id: hit.ref_id,
    imageId: hit.ref_id,
    title: hit.name ?? 'Unknown Card',
    subHeading: hit.set_name ?? undefined,
    metadata: hit.price_key,
    displayPrice: hit.current_price_cents ? hit.current_price_cents / 100 : null,
    imageProxyArgs: { variant: 'tiny', shape: 'card', cardId: hit.ref_id, imageType: 'front' },
  }
}

function WishlistHitItem({ hit, isOpen }: { hit: WishlistHit; isOpen: boolean }) {
  const router = useRouter()
  const displayData = useMemo(() => hitDisplayData(hit), [hit])
  const savings = getSavings(hit)
  const { cardElement, handlePress } = useNavigateToItem({
    kind: 'card',
    item: { id: hit.listing_item_id, name: hit.name, set_name: hit.set_name },
    path: '/profile/[shop-item]',
    paramName: 'shop-item',
    params: { cardId: hit.ref_id, collectionId: hit.listing_collection_id },
  })

  const gradeBadge = <GradeBadge priceKey={hit.price_key} />
  const savingsBadge = savings ? (
    <CardTileBadge label={`-${savings.pct}%`} tone="success" />
  ) : undefined
  const seller = hit.seller_username ?? hit.seller_display_name

  if (!isOpen) {
    return (
      <View ref={cardElement} collapsable={false}>
        <CardTile
          width={ITEM_WIDTH}
          title={displayData.title}
          subtitle={displayData.subHeading}
          price={hit.current_price_cents}
          compareAtPrice={savings?.compareAt}
          badge={gradeBadge}
          trailingBadge={savingsBadge}
          onPress={handlePress}
          renderArt={({ width, height }) => (
            <CardImage
              displayData={displayData}
              width={width}
              height={height}
              cardContainerStyle={{ borderRadius: 0 }}
              imageProps={{ glassEffect: false, enableShadow: false, onPress: handlePress }}
            />
          )}
        />
      </View>
    )
  }

  // Expanded rows sit on the same glass surface as list rows (ItemListView).
  return (
    <LiquidGlassCard
      onPress={handlePress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        borderRadius: 20,
        padding: CARD_LIST_ROW_PADDING,
      }}
    >
      <View ref={cardElement} collapsable={false} style={{ position: 'relative' }}>
        <CardImage
          displayData={displayData}
          width={IMAGE_WIDTH}
          imageProps={{ onPress: handlePress }}
        />
        <View style={{ position: 'absolute', top: 6, left: 6, gap: 4, alignItems: 'flex-start' }}>
          {gradeBadge}
          {savingsBadge}
        </View>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="large" numberOfLines={1} style={{ fontWeight: '600' }}>
          {displayData.title}
        </Text>
        <Text variant="small" numberOfLines={1} style={{ color: Colors.$textNeutral }}>
          {displayData.subHeading}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <Text variant="large" style={{ color: Colors.$textDefault, fontWeight: '700' }}>
            {hit.current_price_cents ? formatPrice(hit.current_price_cents) : '$-.--'}
          </Text>
          {hit.snapshot_price_cents ? (
            <Text
              variant="small"
              style={{
                color: Colors.$textNeutral,
                textDecorationLine: savings ? 'line-through' : 'none',
              }}
            >
              {savings
                ? formatPrice(hit.snapshot_price_cents)
                : `${formatPrice(hit.snapshot_price_cents)} when wishlisted`}
            </Text>
          ) : null}
        </View>
        {seller && (
          <Pressable
            hitSlop={6}
            disabled={!hit.seller_username}
            onPress={() => router.push(`/storefront/${hit.seller_username}` as any)}
          >
            <Text variant="small" style={{ color: Colors.$textNeutral }}>
              Listed by @{seller}
              {hit.other_listings_count > 0 ? ` · +${hit.other_listings_count} more` : ''}
            </Text>
          </Pressable>
        )}
      </View>
    </LiquidGlassCard>
  )
}

export function useAvailableNowSection(config?: HomeFeedSectionConfig) {
  const limit = config?.result_limit ?? 10
  const { data: hits = [], isLoading } = useWishlistHits(limit)

  const rows: HitRow[] = isLoading
    ? Array.from({ length: Math.min(limit, 3) }, (_, i) => ({ id: `skeleton-${i}` }))
    : hits.map((hit) => ({ id: `${hit.listing_item_id}-${hit.price_key}`, hit }))

  // useExpandableSection still runs unconditionally (Rules of Hooks); only the result is
  // swapped for an empty section, as SuggestedSellers does.
  const isEmpty = !isLoading && rows.length === 0

  const section = useExpandableSection({
    icon: (config && HOME_FEED_SECTION_ICONS[config.icon]) ?? Heart,
    title: config?.title ?? 'Wishlist Hits',
    items: rows,
    itemWidth: ITEM_WIDTH,
    expandable: config?.layout.expandable ?? true,
    containerClassNames: 'px-4',
    renderItem: ({ item, isOpen }) =>
      item.hit ? (
        <WishlistHitItem hit={item.hit} isOpen={Boolean(isOpen)} />
      ) : (
        <CardTile width={ITEM_WIDTH} isLoading />
      ),
  })

  return isEmpty ? { header: null, body: null, isOpen: false } : section
}
