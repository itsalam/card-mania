import { TCardSearchItem } from '@/client/price-charting/types'
import { CardItemListProps, CardListView } from '@/features/tcg-card-views/ListCard'

export function SearchPreviewCard({
  searchItem,
  ...props
}: CardItemListProps & {
  searchItem: TCardSearchItem
}) {
  const { card } = searchItem

  return <CardListView card={card} expanded {...props} />
}
