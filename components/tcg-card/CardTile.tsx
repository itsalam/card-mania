import { CARD_ASPECT_RATIO } from '@/components/consts'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { TrendingDown, TrendingUp } from 'lucide-react-native'
import { ReactNode } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { LiquidGlassCard } from './GlassCard'

/** Inset between the glass container edge and the card art. */
export const CARD_TILE_PADDING = 6

/** Tile width for a given art width — for carousels that snap to the tile's outer width. */
export const cardTileWidth = (artWidth: number) => artWidth + CARD_TILE_PADDING * 2

/** Default collapsed-carousel tile (Wishlist Hits, Recently Viewed): 120px art → 132px tile. */
export const DEFAULT_CARD_TILE_WIDTH = cardTileWidth(120)

export type CardTileProps = {
  /** Outer tile width; the art fills it minus CARD_TILE_PADDING on each side. */
  width?: number
  title?: string
  /** Secondary line, e.g. "Base Set · PSA 10". */
  subtitle?: string
  /** In cents. */
  price?: number | null
  /** In cents — shown struck through next to the price (e.g. wishlist target). */
  compareAtPrice?: number
  /** Percent change; shown instead of compareAtPrice when both are set. */
  changePercent?: number
  /** Overlaid on the art's top-left corner — the grade (GradeBadge). */
  badge?: ReactNode
  /** Overlaid on the art's top-right corner — e.g. savings %. */
  trailingBadge?: ReactNode
  isLoading?: boolean
  onPress?: () => void
  /** Renders the card art at the given size; the tile clips it to rounded corners. */
  renderArt?: (size: { width: number; height: number }) => ReactNode
}

/**
 * Compact collectible tile for carousels and grids: glass container wrapping inset card art
 * with an info block beneath (name → set/grade → price). Expanded list rows use ItemListView.
 * References: Shop and Qantas Marketplace product tiles — badge on image, info inside one
 * rounded container (https://mobbin.com/screens/c7843a19-a6c4-4874-b714-b2ed852a40ba,
 * https://mobbin.com/screens/36f232ef-dd11-4c75-904e-77fdaea053d3); Coinbase NFT grid for the
 * dark-mode name/price caption (https://refero.design/screens/c2b7ac74-d1a7-4ecb-aac6-5b0205fb34b2).
 */
export function CardTile({
  width = DEFAULT_CARD_TILE_WIDTH,
  title,
  subtitle,
  price,
  compareAtPrice,
  changePercent,
  badge,
  trailingBadge,
  isLoading,
  onPress,
  renderArt,
}: CardTileProps) {
  const artWidth = width - CARD_TILE_PADDING * 2
  const artHeight = Math.round(artWidth / CARD_ASPECT_RATIO)

  return (
    <LiquidGlassCard
      onPress={onPress}
      style={{ width, borderRadius: 16, padding: CARD_TILE_PADDING }}
    >
      <View
        style={{
          width: artWidth,
          height: artHeight,
          borderRadius: 10,
          overflow: 'hidden',
          backgroundColor: Colors.rgba(Colors.$backgroundNeutral, 0.6),
        }}
      >
        {renderArt?.({ width: artWidth, height: artHeight })}
        {badge && <View style={{ position: 'absolute', top: 6, left: 6 }}>{badge}</View>}
        {trailingBadge && (
          <View style={{ position: 'absolute', top: 6, right: 6 }}>{trailingBadge}</View>
        )}
      </View>

      <View style={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2, gap: 3 }}>
        {isLoading ? (
          <>
            <Skeleton style={{ height: 13, width: '80%' }} />
            <Skeleton style={{ height: 11, width: '55%' }} />
            <Skeleton style={{ height: 15, width: '45%' }} />
          </>
        ) : (
          <>
            {title && (
              <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, fontWeight: '600' }}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                numberOfLines={1}
                style={{ fontSize: 11, lineHeight: 14, color: Colors.$textNeutral }}
              >
                {subtitle}
              </Text>
            )}
            <PriceLine
              price={price}
              compareAtPrice={compareAtPrice}
              changePercent={changePercent}
            />
          </>
        )}
      </View>
    </LiquidGlassCard>
  )
}

function PriceLine({
  price,
  compareAtPrice,
  changePercent,
}: Pick<CardTileProps, 'price' | 'compareAtPrice' | 'changePercent'>) {
  const hasChange = typeof changePercent === 'number' && changePercent !== 0
  const isUp = hasChange && changePercent > 0
  const changeColor = isUp ? Colors.$textSuccess : Colors.$textDanger
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
      <Text style={{ fontSize: 15, lineHeight: 19, fontWeight: '700' }}>
        {price ? formatPrice(price) : '$-.--'}
      </Text>
      {hasChange ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {isUp ? (
            <TrendingUp size={12} color={changeColor} />
          ) : (
            <TrendingDown size={12} color={changeColor} />
          )}
          <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: changeColor }}>
            {`${Math.abs(changePercent).toFixed(1)}%`}
          </Text>
        </View>
      ) : (
        compareAtPrice !== undefined && (
          <Text
            style={{
              fontSize: 11,
              lineHeight: 14,
              color: Colors.$textNeutral,
              textDecorationLine: 'line-through',
            }}
          >
            {formatPrice(compareAtPrice)}
          </Text>
        )
      )}
    </View>
  )
}

/** Small pill for the art corner, e.g. savings ("-22%"). Grades use GradeBadge. */
export function CardTileBadge({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'success'
}) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 7,
        paddingVertical: 2,
        backgroundColor:
          tone === 'success'
            ? Colors.$backgroundSuccessLight
            : Colors.rgba(Colors.$backgroundDefault, 0.85),
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
      }}
    >
      <Text
        variant="stats"
        style={{
          fontSize: 10,
          lineHeight: 13,
          color: tone === 'success' ? Colors.$textSuccess : Colors.$textDefault,
        }}
      >
        {label}
      </Text>
    </View>
  )
}
