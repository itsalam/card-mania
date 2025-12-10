import { useViewCollectionForUser } from '@/client/collections/query'
import { CollectionListView } from '@/components/collections/list-item'
import { View } from 'react-native'
import { useCollectionsPageStore } from '../provider'

export const DefaultCollectionsPage = () => {
  const { data, error } = useViewCollectionForUser()
  const { setCurrentPage, preferenceState } = useCollectionsPageStore()

  return (
    <View>
      {data?.map((collection) => (
        <CollectionListView
          collection={collection}
          onPress={() => {
            preferenceState.updatePreferences({
              tabs: Array.from(
                new Set([...(preferenceState.preferences.tabs ?? []), collection.id])
              ),
            })
            setCurrentPage(collection.id)
          }}
        />
      ))}
    </View>
  )
}
