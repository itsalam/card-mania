import FocusCardView from '@/components/tcg-card/views/DetailCardView'
import { Heading } from '@/components/ui/heading'
import { useRoute } from '@react-navigation/native'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export const CardScreenHeader = (props: { title: string; backgroundColor?: string }) => {
  const { title, backgroundColor = Colors.rgba(Colors.$textPrimary, 0.8) } = props
  return (
    <View className="w-full py-1 flex flex-row items-center justify-center gap-3">
      <View style={{ backgroundColor, height: 1.5, width: 32 }} />
      <Heading style={{ color: backgroundColor }} size="lg" className="font-spaceMono">
        {title}
      </Heading>
      <View style={{ backgroundColor, height: 2, flex: 1, marginLeft: 6 }} />
    </View>
  )
}

export default function CardsRoute() {
  const route = useRoute<any>()
  const {
    card: cardId,
    from,
    image,
  } = route.params as { card: string; from: string; image: string }

  const fromPos = JSON.parse(from) as { x: number; y: number; width: number; height: number }

  return <FocusCardView cardId={cardId} baseImage={image} animateFrom={fromPos} />
}
