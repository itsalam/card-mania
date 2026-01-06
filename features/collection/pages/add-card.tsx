import { CollectionLike } from '@/client/collections/types'
import { CollectionCardItemEntries } from '@/components/tcg-card/views/DetailCardView/footer/add-to-collections/components'
import { ItemListViewProps } from '@/components/tcg-card/views/ListCard'
import { TCard } from '@/constants/types'
import { SearchScreen } from '@/features/mainSearchbar/components/SearchScreen'
import { router } from 'expo-router'
import { useGetCollection } from '../hooks'

const renderAccessories = (collection: CollectionLike) => (props: ItemListViewProps) => {
  return <CollectionCardItemEntries card={props.item as TCard} collection={collection} isShown />
}

export default function AddCardToCollection({ collectionId }: { collectionId: string }) {
  const { data: collection } = useGetCollection({ collectionId })
  const AddCardToCollectionAccessories = renderAccessories(collection!)
  return (
    <SearchScreen
      itemAccessories={(props) => <AddCardToCollectionAccessories {...props} />}
      hide={() => {
        router.back()
      }}
    />
  )
}
