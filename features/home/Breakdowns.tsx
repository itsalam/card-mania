import { CollectionIdArgs } from '@/client/collections/types'
import { ChartPressProvider, DateRangeProvider, PriceGraph } from '@/components/graphs/PriceGraph'
import { useMemo } from 'react'
import { View } from 'react-native'
import CollectionBreakdown from '../collection/components/CollectionBreakdown'
import { DefaultCollectionData } from '../collection/helpers'
import { useCollectionHistory } from '../collection/hooks'

//@ts-ignore
const DefaultCollectionIndex: Partial<Record<CollectionIdArgs['collectionType'], number>> = {
  wishlist: 0,
  selling: 1,
  vault: 2,
}

const getCollectionColor = (collectionIdArgs?: CollectionIdArgs): string | undefined => {
  const type = collectionIdArgs?.collectionType
  if (!type) return undefined
  const index = DefaultCollectionIndex[type]
  if (index === undefined) return undefined
  return DefaultCollectionData[index]?.colors?.[0] ?? undefined
}

const COLLECTION_TYPES = ['wishlist', 'selling', 'vault'] as const

const ALL_Y_KEYS = ['wishlist_price', 'selling_price', 'vault_price'] as const
const TYPE_TO_Y_KEY: Record<string, string> = {
  wishlist: 'wishlist_price',
  selling: 'selling_price',
  vault: 'vault_price',
}

export const Graphs = ({
  height = 284,
  selectedCollections,
}: {
  height?: number
  selectedCollections?: string[]
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

  // Merge the three per-collection price series into one dataset keyed by day.
  // Multiple snapshots on the same day are collapsed to the last one (most recent wins).
  // Missing days for a collection produce no entry for that y-key, which Victory Native
  // handles gracefully via connectMissingData.
  const mergedData = useMemo(() => {
    if (!wishlistHistory && !sellingHistory && !vaultHistory) return undefined

    const byDay = new Map<string, Record<string, string | number>>()
    const add = (
      history: { snapshotted_at: string; total_cents: number }[] | undefined,
      key: string
    ) => {
      history?.forEach(({ snapshotted_at, total_cents }) => {
        // Snap to midnight so multiple intra-day snapshots merge into one point.
        const d = new Date(snapshotted_at)
        d.setHours(0, 0, 0, 0)
        const day = String(d.getTime())
        if (!byDay.has(day)) byDay.set(day, { day })
        // Later snapshots overwrite earlier ones for the same day.
        byDay.get(day)![key] = total_cents
      })
    }

    add(wishlistHistory, 'wishlist_price')
    add(sellingHistory, 'selling_price')
    add(vaultHistory, 'vault_price')

    const rows = [...byDay.values()].sort((a, b) => Number(a.day) - Number(b.day))
    return rows.length ? rows : undefined
  }, [wishlistHistory, sellingHistory, vaultHistory])

  const activeTypes = selectedCollections ?? [...COLLECTION_TYPES]
  const activeYKeys = COLLECTION_TYPES.filter((t) => activeTypes.includes(t)).map(
    (t) => TYPE_TO_Y_KEY[t]
  ) as (typeof ALL_Y_KEYS)[number][]

  const seriesColors = COLLECTION_TYPES.filter((t) => activeTypes.includes(t))
    .map((t) => getCollectionColor({ collectionType: t }))
    .filter(Boolean) as string[]

  return (
    <DateRangeProvider
      isLoading={isLoading}
      renderChildren={(controlComponent) => (
        <View style={{ height }}>
          <ChartPressProvider>
            <PriceGraph<Record<string, string | number>>
              xKey="day"
              yKeys={activeYKeys.length ? activeYKeys : [...ALL_Y_KEYS]}
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
