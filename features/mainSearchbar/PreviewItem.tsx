import { TCardSearchItem } from '@/client/card-search/types'
import { CardListView } from '@/features/tcg-card-views/ListCard'
import { CardItemListProps } from '../tcg-card-views/types'

export function SearchPreviewCard({
  searchItem,
  ...props
}: CardItemListProps & {
  searchItem: TCardSearchItem
}) {
  const { card } = searchItem

  return <CardListView card={card} expanded {...props} />
}
