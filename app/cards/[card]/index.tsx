import FocusCardView from '@/features/tcg-card-views/DetailCardView'
import { parseAnimateFrom } from '@/features/tcg-card-views/DetailCardView/animate-from'
import { useRoute } from '@react-navigation/native'
import { Href } from 'expo-router'

type CardRouteParams = {
  card: string
  from?: string
  image?: string
  returnTo?: Href
}

export default function CardsRoute() {
  const route = useRoute<any>()
  const { card: cardId, from, image, returnTo } = route.params as CardRouteParams

  const fromPos = parseAnimateFrom(from)

  return (
    <FocusCardView
      cardId={cardId}
      animateFrom={fromPos}
      returnTo={returnTo}
      preferredImageId={image}
    />
  )
}
