import { TCardSearchItem } from '@/client/price-charting/types'
import { ListCard } from '@/components/tcg-card/views/ListCard'

export function PreviewCard({
  searchItem,
  isWishlisted = false,
}: {
  searchItem: TCardSearchItem
  isWishlisted?: boolean
}) {
  const { card } = searchItem

  return <ListCard isWishlisted={isWishlisted} card={card} expanded />
}
