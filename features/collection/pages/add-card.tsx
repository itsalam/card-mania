import { useViewCollectionItemsForCard } from '@/client/collections/query'
import { CollectionLike } from '@/client/collections/types'
import { CollectionCardEntries } from '@/components/tcg-card/views/DetailCardView/footer/add-to-collections/components'
import { ItemListViewProps } from '@/components/tcg-card/views/ListCard'
import { TCard } from '@/constants/types'
import { SearchScreen } from '@/features/mainSearchbar/components/SearchScreen'
import { useGetCollection } from '../hooks'

const renderAccessories = (collection: CollectionLike) => (props: ItemListViewProps) => {
  const {
    data: loadedEntries,
    error,
    isLoading,
  } = useViewCollectionItemsForCard(collection.id!, props.item?.id!, true)

  return <CollectionCardEntries card={props.item as TCard} collection={collection} isShown />
}

export default function AddCardToCollection({ collectionId }: { collectionId: string }) {
  const { data: collection } = useGetCollection({ collectionId })
  const AddCardToCollectionAccessories = renderAccessories(collection!)
  return <SearchScreen itemAccessories={(props) => <AddCardToCollectionAccessories {...props} />} />
}
