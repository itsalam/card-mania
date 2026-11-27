'use client'
import { useCollectionTotal, useWishlistTotal } from '@/client/collections/query'
import { splitOwnedValue } from '@/client/collections/valuation'
import { Text } from '@/components/ui/text/base-text'
import { formatCompactPrice } from '@/components/utils'
import { MotiView } from 'moti'
import { Pressable, StyleProp, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { DefaultCollectionData } from '../helpers'

/** The value series the breakdown and the Home chart share. */
export type BreakdownSeries = 'pc' | 'for_sale' | 'wishlist'
export const BREAKDOWN_SERIES: readonly BreakdownSeries[] = ['pc', 'for_sale', 'wishlist']

export const BREAKDOWN_SERIES_COLORS: Record<BreakdownSeries, [string, string]> = {
  pc: DefaultCollectionData[2].colors as [string, string],
  for_sale: DefaultCollectionData[1].colors as [string, string],
  wishlist: DefaultCollectionData[0].colors as [string, string],
}

function Row({
  series,
  label,
  value,
  detail,
  selected,
  onToggleSeries,
}: {
  series: BreakdownSeries
  label: string
  value: number
  detail: string
  selected: readonly string[]
  onToggleSeries?: (series: BreakdownSeries) => void
}) {
  const [color] = BREAKDOWN_SERIES_COLORS[series]
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: selected.includes(series) ? 1 : 0.4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text variant="small" style={{ color: Colors.$textNeutral }}>
          {label}
        </Text>
      </View>
      <Text variant="small">
        {formatCompactPrice(value)}
        <Text variant="small" style={{ color: Colors.$textNeutralLight }}>
          {`  ${detail}`}
        </Text>
      </Text>
    </View>
  )
  return onToggleSeries ? (
    <Pressable
      onPress={() => onToggleSeries(series)}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${formatCompactPrice(value)}`}
    >
      {content}
    </Pressable>
  ) : (
    content
  )
}

/**
 * What you own, split into PC and For sale (they add up to Total Value, the Vault), with the
 * Wishlist below it as a separate, not-owned figure. The Vault already contains the Selling
 * cards, so the three collections can't be shown as shares of one sum without counting the
 * for-sale cards twice (ITS-133, docs/collections/valuation.md).
 *
 * With `onToggleSeries`, each row switches its line on the chart below.
 */
export default function CollectionBreakdown({
  style,
  className,
  selectedSeries,
  onToggleSeries,
  footnote,
}: {
  style?: StyleProp<ViewStyle>
  className?: string
  selectedSeries?: string[]
  onToggleSeries?: (series: BreakdownSeries) => void
  footnote?: string
}) {
  const { data: wishlistTotal = 0 } = useWishlistTotal()
  const { data: sellingTotal = 0 } = useCollectionTotal({ collectionType: 'selling' })
  const { data: vaultTotal = 0 } = useCollectionTotal({ collectionType: 'vault' })
  const { total, pc, forSale } = splitOwnedValue(vaultTotal, sellingTotal)

  const selected = selectedSeries ?? BREAKDOWN_SERIES
  const owned = [
    { key: 'pc' as const, label: 'PC', value: pc },
    { key: 'for_sale' as const, label: 'For sale', value: forSale },
  ]

  return (
    <View
      className={className}
      style={[
        {
          padding: 12,
          gap: 8,
          borderRadius: 12,
          backgroundColor: Colors.rgba(Colors.$backgroundNeutral, 0.5),
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        },
        style,
      ]}
    >
      {/* Owned value: PC + For sale = Total Value */}
      <View
        style={{
          flexDirection: 'row',
          height: 6,
          borderRadius: 99,
          overflow: 'hidden',
          gap: total > 0 ? 2 : 0,
          backgroundColor: Colors.$backgroundNeutral,
        }}
      >
        {owned.map((r) =>
          total > 0 && r.value > 0 ? (
            <MotiView
              key={r.key}
              animate={{ opacity: selected.includes(r.key) ? 1 : 0.15 }}
              transition={{ type: 'timing', duration: 200 }}
              style={{ flex: r.value / total, backgroundColor: BREAKDOWN_SERIES_COLORS[r.key][0] }}
            />
          ) : null
        )}
      </View>
      {owned.map((r) => (
        <Row
          key={r.key}
          series={r.key}
          label={r.label}
          value={r.value}
          detail={`${total > 0 ? Math.round((r.value / total) * 100) : 0}%`}
          selected={selected}
          onToggleSeries={onToggleSeries}
        />
      ))}

      {/* Not owned, so it sits apart from the split and has no share of it. */}
      <View
        style={{
          height: 1,
          marginVertical: 2,
          backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        }}
      />
      <Row
        series="wishlist"
        label="Wishlist"
        value={wishlistTotal}
        detail="Not owned"
        selected={selected}
        onToggleSeries={onToggleSeries}
      />

      {footnote ? (
        <Text
          variant="small"
          numberOfLines={1}
          style={{ color: Colors.$textNeutralLight, fontSize: 11 }}
        >
          {footnote}
        </Text>
      ) : null}
    </View>
  )
}
