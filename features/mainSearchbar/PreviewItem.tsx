import { TCardSearchItem } from '@/client/price-charting/types'
import { ListCard } from '@/components/tcg-card/views/ListCard'
import { useStores } from '@/store/provider'
import { router } from 'expo-router'
import { useRef } from 'react'
import { Pressable, View } from 'react-native'
import { useOverlay } from '../overlay/provider'
import { measureInWindowAsync } from '../overlay/utils'

export function PreviewCard({ searchItem }: { searchItem: TCardSearchItem }) {
  const { setPrefetchData } = useStores().cardStore.getInitialState()
  const { card } = searchItem
  const cardElement = useRef<View>(null)
  const { hiddenId, setHiddenId } = useOverlay()

  const handlePress = () => {
    const positionPromise = measureInWindowAsync(cardElement as React.RefObject<View>)
    setPrefetchData(card.id, card)
    positionPromise.then((position) => {
      setHiddenId(card.id)
      router.navigate({
        pathname: `/cards/[card]`,
        params: { from: JSON.stringify(position), card: card.id },
      })
    })
  }

  return (
    <Pressable onPress={() => handlePress()}>
      <ListCard
        className="flex flex-row items-center gap-2 p-2 w-full"
        card={card}
        expanded
        cardRef={cardElement}
      />
    </Pressable>
  )
}
