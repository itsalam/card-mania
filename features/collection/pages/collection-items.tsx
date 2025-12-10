import { CollectionIdArgs } from '@/client/collections/types'
import { ImageProxyOpts } from '@/client/image-proxy'
import { ItemListView } from '@/components/tcg-card/views/ListCard'
import { SearchBar } from '@/components/ui/search'
import { TCard } from '@/constants/types'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { useMemo } from 'react'
import { View } from 'react-native'
import { useGetCollectionItems } from '../hooks'

export const CollectionsPage = ({ collectionKey }: { collectionKey: CollectionIdArgs }) => {
  const { query } = useGetCollectionItems<CollectionItemQueryView & TCard>(collectionKey)

  const { data: items } = query
  const cards = useMemo(() => items?.pages.flat() ?? [], [items])

  console.log(
    JSON.stringify(
      cards.map((c) => ({
        price: c.price_key,
        title: c.name,
        id: c.id,
        collectionid: c.collection_item_id,
      })),
      null,
      2
    )
  )

  return (
    <>
      <SearchBar />

      {cards.map((card) => (
        <View key={card.collection_item_id} className="w-full">
          <CollectionItemListView
            card={card}
            // isWishlisted={wishlistedIds?.has(`${card.id}`) ?? false}
          />
        </View>
      ))}
    </>
  )
}

function CollectionItemListView({ card }: { card: CollectionItemQueryView & TCard }) {
  const displayPrice = getPriceFix(card)
  console.log({ displayPrice })
  const displayData = {
    title: card.name,
    subHeading: card.set_name,
    metadata: card.price_key,
    imageProxyArgs: {
      variant: 'tiny',
      shape: 'card',
      cardId: card?.id ?? undefined,
      imageType: 'front',
      queryHash: card?.image?.query_hash ?? undefined,
    } as ImageProxyOpts,
    displayPrice,
  }
  return <ItemListView item={card} displayData={displayData} />
}

const getPriceFix = (card: CollectionItemQueryView & TCard) => {
  let price = card.collection_item_value
  if (price) return price

  if (!card.price_key) return undefined

  const priceKey = card.price_key.replace(/(\d+)(?:\.(\d))?/g, (_match, intPart, fracPart) =>
    !fracPart || fracPart === '0' ? intPart : `${intPart}_${fracPart}`
  )

  const gradePrice = card.grades_prices as Record<string, number>

  if (priceKey in gradePrice) return gradePrice[priceKey]
  return undefined
}
