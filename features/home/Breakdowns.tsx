import { useWishlistTotal } from '@/client/collections/query'
import { View } from 'react-native'
import CollectionBreakdown from '../collection/components/CollectionBreakdown'

export default function BreakdownData() {
  const { data: wishlistTotal, ...wishlistReq } = useWishlistTotal()
  const { data: sellingTotal } = useSellingTotal()
  const { data: portfolioTotal } = usePortfolioTotal()

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
    </View>
  )
}
