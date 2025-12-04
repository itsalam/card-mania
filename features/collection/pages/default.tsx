import { useViewCollectionForUser } from '@/client/collections/query'
import { CollectionListView } from '@/components/collections/list-item'
import { View } from 'react-native'
import { useCollectionsPageStore } from '../provider'

export const DefaultCollectionsPage = () => {
  const { data, error } = useViewCollectionForUser()
  const { setCurrentPage } = useCollectionsPageStore()

  console.log(data, error)
  return (
    <View>
      {data?.map((collection) => (
        <CollectionListView
          collection={collection}
          onPress={() => {
            setCurrentPage(collection.id)
          }}
        />
      ))}
    </View>
  )
}
