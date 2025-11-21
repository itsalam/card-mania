import FocusCardView from '@/components/tcg-card/views/DetailCardView';
import { useRoute } from '@react-navigation/native';
import { Href } from 'expo-router';

type CardRouteParams = {
  card: string
  from: string
  image?: string
  returnTo?: Href
}

export default function CardsRoute() {
  const route = useRoute<any>()
  const { card: cardId, from, image, returnTo } = route.params as CardRouteParams

  const fromPos = JSON.parse(from) as { x: number; y: number; width: number; height: number }

  return <FocusCardView cardId={cardId} animateFrom={fromPos} returnTo={returnTo} />
}
