import { TCardSearchItem } from '@/client/price-charting/types'
import { CardListView } from '@/features/tcg-card-views/ListCard'
import { CardItemListProps } from '../tcg-card-views/types'

export function SearchPreviewCard({
  searchItem,
  ...props
}: Omit<CardItemListProps, 'itemId' | 'card' | 'gain'> & {
  searchItem: TCardSearchItem
}) {
  const { card } = searchItem
  const gain: number | undefined = searchItem.reason?.gain

  //@ts-ignore
  return <CardListView card={card} gain={gain} expanded {...props} />
}
