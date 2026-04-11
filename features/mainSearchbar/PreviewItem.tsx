import { TCardSearchItem } from '@/client/price-charting/types'
import { CardItemListProps, CardListView } from '@/features/tcg-card-views/ListCard'

export function SearchPreviewCard({
  searchItem,
  ...props
}: CardItemListProps & {
  searchItem: TCardSearchItem
}) {
  const { card } = searchItem
  const gain: number | undefined = searchItem.reason?.gain

  return <CardListView card={card} gain={gain} expanded {...props} />
}
