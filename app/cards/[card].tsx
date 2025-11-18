import FocusCardView from '@/components/tcg-card/views/DetailCardView'
import { useRoute } from '@react-navigation/native'

export default function CardsRoute() {
  const route = useRoute<any>()
  const {
    card: cardId,
    from,
    image,
  } = route.params as { card: string; from: string; image: string }

  const fromPos = JSON.parse(from) as { x: number; y: number; width: number; height: number }
  console.log(route.params)
  console.log('FUCK')
  return <FocusCardView cardId={cardId} baseImage={image} animateFrom={fromPos} />
}
