import FocusCardView from '@/features/tcg-card-views/DetailCardView'
import { parseAnimateFrom } from '@/features/tcg-card-views/DetailCardView/animate-from'
import { useRoute } from '@react-navigation/native'
import { Href } from 'expo-router'

type CardRouteParams = {
  cardId: string
  collectionId: string
  from?: string
  image?: string
  returnTo?: Href
  ['shop-item']: string
}

export default function ShopItemRoute() {
  const route = useRoute<any>()
  const {
    cardId,
    from,
    image,
    returnTo,
    collectionId,
    ['shop-item']: itemId,
  } = route.params as CardRouteParams
  const fromPos = parseAnimateFrom(from)

  return (
    <FocusCardView
      cardId={cardId}
      collectionIdArgs={{ collectionId, itemId }}
      animateFrom={fromPos}
      returnTo={returnTo}
      preferredImageId={image}
    />
  )
}
