import { useCollectionTotal } from '@/client/collections/query'
import { CollectionIdArgs } from '@/client/collections/types'
import { ChartPressProvider, DateRangeProvider, PriceGraph } from '@/components/graphs/PriceGraph'
import { GraphInputKey } from '@/components/graphs/ui/types'
import { useMemo } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import CollectionBreakdown from '../collection/components/CollectionBreakdown'
import { DefaultCollectionData } from '../collection/helpers'
import { useSpoofedCollectionPrices } from '../collection/hooks'

//@ts-ignore
const DefaultCollectionIndex: Partial<Record<CollectionIdArgs['collectionType'], number>> = {
  wishlist: 0,
  selling: 1,
  vault: 2,
}

const getCollectionColor = (collectionIdArgs?: CollectionIdArgs) => {
  const type = collectionIdArgs?.collectionType
  if (!type) return undefined

  const index = DefaultCollectionIndex[type]
  if (index === undefined) return undefined

  const colors = DefaultCollectionData[index]?.colors
  return colors?.[0] ?? undefined
}

const CollectionPriceGraph = ({
  collectionIdArgs,
  style,
  priceHistory,
  sellingTotal,
  showTooltipLabel,
}: {
  collectionIdArgs: CollectionIdArgs
  style?: StyleProp<ViewStyle>
  priceHistory?: ReturnType<typeof useSpoofedCollectionPrices>['data']
  sellingTotal?: number | null
  showTooltipLabel?: boolean
}) => {
  const { data: fetchedSellingTotal } = useCollectionTotal(collectionIdArgs)
  const resolvedSellingTotal = sellingTotal ?? fetchedSellingTotal
  const { data: fetchedPriceHistory } = useSpoofedCollectionPrices(
    collectionIdArgs,
    resolvedSellingTotal
  )
  const history = priceHistory ?? fetchedPriceHistory

  return (
    <PriceGraph<Record<string, string | number>>
      xKey={'day' as GraphInputKey<typeof priceHistory>}
      yKeys={['price']}
      data={history?.prices}
      color={getCollectionColor(collectionIdArgs)}
      height={90}
      style={style}
      showTooltipLabel={showTooltipLabel}
    />
  )
}

export const Graphs = ({ height = 248 }: { height?: number }) => {
  const { data: wishlistTotal } = useCollectionTotal({ collectionType: 'wishlist' })
  const { data: sellingTotal } = useCollectionTotal({ collectionType: 'selling' })
  const { data: vaultTotal } = useCollectionTotal({ collectionType: 'vault' })

  const { data: wishlistPriceHistory } = useSpoofedCollectionPrices(
    { collectionType: 'wishlist' },
    wishlistTotal
  )
  const { data: sellingPriceHistory } = useSpoofedCollectionPrices(
    { collectionType: 'selling' },
    sellingTotal
  )
  const { data: vaultPriceHistory } = useSpoofedCollectionPrices(
    { collectionType: 'vault' },
    vaultTotal
  )

  const isLoading = useMemo(
    () =>
      !(wishlistPriceHistory?.prices && sellingPriceHistory?.prices && vaultPriceHistory?.prices),
    [wishlistPriceHistory?.prices, sellingPriceHistory?.prices, vaultPriceHistory?.prices]
  )

  return (
    <DateRangeProvider
      isLoading={isLoading}
      renderChildren={(controlComponent) => (
        <View style={{ height }}>
          <ChartPressProvider>
            <CollectionPriceGraph
              collectionIdArgs={{ collectionType: 'wishlist' }}
              priceHistory={wishlistPriceHistory}
              sellingTotal={wishlistTotal}
            />
            <CollectionPriceGraph
              collectionIdArgs={{ collectionType: 'selling' }}
              priceHistory={sellingPriceHistory}
              sellingTotal={sellingTotal}
              style={{ zIndex: 1, transform: [{ translateY: -40 }] }}
              showTooltipLabel={false}
            />
            <CollectionPriceGraph
              collectionIdArgs={{ collectionType: 'vault' }}
              priceHistory={vaultPriceHistory}
              sellingTotal={vaultTotal}
              style={{ zIndex: 2, transform: [{ translateY: -80 }] }}
              showTooltipLabel={false}
            />
          </ChartPressProvider>
          <View
            style={{
              paddingHorizontal: 38,
              transform: [{ translateY: -66 }],
            }}
          >
            {controlComponent}
          </View>
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
