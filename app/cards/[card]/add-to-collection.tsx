import CardMenuModalView from '@/features/tcg-card-views/menu-view'
import { useRoute } from '@react-navigation/native'
import { Href } from 'expo-router'

type CardRouteParams = {
  card: string
  from: string
  image?: string
  returnTo?: Href
}

export default function Route() {
  const route = useRoute<any>()
  const { card: cardId, from, image, returnTo } = route.params as CardRouteParams
  return <CardMenuModalView cardId={cardId} />
}
