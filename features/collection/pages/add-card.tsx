import { CollectionLike } from '@/client/collections/types'
import { TCard } from '@/constants/types'
import { SearchScreen } from '@/features/mainSearchbar/components/SearchScreen'

import { CollectionCardItemEntries } from '@/features/tcg-card-views/DetailCardView/footer/pages/add-to-collections/components'
import { ItemListViewProps } from '@/features/tcg-card-views/ListCard'
import { router } from 'expo-router'
import { useGetCollection } from '../hooks'

const AddCardToCollectionAccessories = ({
  collection,
  ...props
}: ItemListViewProps & { collection: CollectionLike }) => {
  return <CollectionCardItemEntries card={props.item as TCard} collection={collection} isShown />
}

export default function AddCardToCollection({ collectionId }: { collectionId: string }) {
  const { data: collection } = useGetCollection({ collectionId })
  return (
    <SearchScreen
      itemAccessories={(props) => (
        <AddCardToCollectionAccessories collection={collection!} {...props} />
      )}
      hide={() => {
        router.back()
      }}
    />
  )
}
