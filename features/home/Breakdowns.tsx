import { ChartPressProvider, DateRangeProvider, PriceGraph } from '@/components/graphs/PriceGraph'
import { useMemo } from 'react'
import { View } from 'react-native'
import { splitOwnedValue } from '@/client/collections/valuation'
import CollectionBreakdown, {
  BREAKDOWN_SERIES,
  BREAKDOWN_SERIES_COLORS,
  BreakdownSeries,
} from '../collection/components/CollectionBreakdown'
import { useCollectionHistory } from '../collection/hooks'

const SERIES_Y_KEY = {
  pc: 'pc_price',
  for_sale: 'for_sale_price',
  wishlist: 'wishlist_price',
} as const satisfies Record<BreakdownSeries, string>
type SeriesYKey = (typeof SERIES_Y_KEY)[BreakdownSeries]
type ChartRow = { day: string } & Partial<Record<SeriesYKey, number>>

type HistoryPoint = { snapshotted_at: string; total_cents: number }

/** Last snapshot per day (midnight-snapped), keyed by the day's timestamp. */
function byDay(history: HistoryPoint[] | undefined) {
  const days = new Map<number, number>()
  history?.forEach(({ snapshotted_at, total_cents }) => {
    const d = new Date(snapshotted_at)
    d.setHours(0, 0, 0, 0)
    // History is oldest first, so a later snapshot the same day overwrites an earlier one.
    days.set(d.getTime(), total_cents)
  })
  return days
}

export const Graphs = ({
  height = 284,
  selectedSeries,
}: {
  height?: number
  selectedSeries?: string[]
}) => {
  const { data: wishlistHistory, isLoading: wLoading } = useCollectionHistory({
    collectionType: 'wishlist',
  })
  const { data: sellingHistory, isLoading: sLoading } = useCollectionHistory({
    collectionType: 'selling',
  })
  const { data: vaultHistory, isLoading: vLoading } = useCollectionHistory({
    collectionType: 'vault',
  })

  const isLoading = wLoading || sLoading || vLoading

  // One row per day with the breakdown's series: PC (Vault minus Selling), For sale (Selling,
  // capped at the Vault) and Wishlist. Each collection's value carries forward over days
  // with no snapshot, so PC is always taken from the same day's Vault and Selling values.
  const mergedData = useMemo(() => {
    if (!wishlistHistory && !sellingHistory && !vaultHistory) return undefined
    const vault = byDay(vaultHistory)
    const selling = byDay(sellingHistory)
    const wishlist = byDay(wishlistHistory)
    const days = [...new Set([...vault.keys(), ...selling.keys(), ...wishlist.keys()])].sort(
      (a, b) => a - b
    )

    let v: number | undefined
    let s: number | undefined
    let w: number | undefined
    const rows = days.map((day) => {
      v = vault.get(day) ?? v
      s = selling.get(day) ?? s
      w = wishlist.get(day) ?? w
      const row: ChartRow = { day: String(day) }
      if (v != null) {
        const { pc, forSale } = splitOwnedValue(v, s ?? 0)
        row.pc_price = pc
        row.for_sale_price = forSale
      }
      if (w != null) row.wishlist_price = w
      return row
    })
    return rows.length ? rows : undefined
  }, [wishlistHistory, sellingHistory, vaultHistory])

  const active = BREAKDOWN_SERIES.filter((t) => (selectedSeries ?? BREAKDOWN_SERIES).includes(t))
  const activeYKeys = (active.length ? active : BREAKDOWN_SERIES).map((t) => SERIES_Y_KEY[t])
  const seriesColors = (active.length ? active : BREAKDOWN_SERIES).map(
    (t) => BREAKDOWN_SERIES_COLORS[t][0]
  )

  return (
    <DateRangeProvider
      isLoading={isLoading}
      renderChildren={(controlComponent) => (
        <View style={{ height }}>
          <ChartPressProvider>
            <PriceGraph<ChartRow>
              xKey="day"
              yKeys={activeYKeys}
              data={mergedData}
              colors={seriesColors}
              height={height - 52}
            />
          </ChartPressProvider>
          {controlComponent}
        </View>
      )}
    />
  )
}

export default function BreakdownGraphs() {
  return (
    <View>
      <CollectionBreakdown
        style={{
          paddingTop: 12,
          marginTop: 48,
          marginBottom: 40,
          marginHorizontal: 12,
        }}
      />
      <Graphs />
    </View>
  )
}
