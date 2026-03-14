import { CollectionLike } from '@/client/collections/types'
import { TCard } from '@/constants/types'
import { useGetCollection, useGetCollectionItems } from '@/features/collection/hooks'
import { CardListView } from '@/features/tcg-card-views/ListCard'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { View } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'

type CollectionPreviewProps = { collectionId?: string }

export function StorefrontView({ collectionId }: CollectionPreviewProps) {
  const { data: collection, isLoading: isLoadingCollection } = useGetCollection({ collectionId })
  const isLoading = !collectionId || isLoadingCollection
  return (
    <View
      style={{
        borderRadius: BorderRadiuses.br40,
        backgroundColor: Colors.$backgroundElevated,
      }}
    >
      {collection && <StorefrontPreviewItems collection={collection} />}
    </View>
  )
}

type CollectionPreviewItemProps = { collection: CollectionLike }

function StorefrontPreviewItems({ collection }: CollectionPreviewItemProps) {
  const { query } = useGetCollectionItems({ collectionId: collection?.id }, undefined, false)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = query
  const flatData = data?.pages.flat() ?? []

  return (
    <FlatList
      data={flatData}
      keyExtractor={(item) => item.collection_item_id}
      renderItem={({ item: collectionItem }) => {
        const graded = collectionItem?.price_key !== 'ungraded'

        return (
          <CardListView
            collectionItem={{ ...collectionItem, id: collectionItem.collection_item_id }}
            cardContainerStyle={
              graded
                ? {
                    paddingVertical: 8,
                    paddingHorizontal: 2,
                    backgroundColor: Colors.$backgroundElevatedLight,
                  }
                : {
                    paddingVertical: 8,
                    paddingHorizontal: 2,
                  }
            }
            style={{ padding: 8 }}
            card={collectionItem}
            expanded={true}
            navigateTo="/profile/[shop-item]"
          />
        )
      }}
    />
  )
}

export function StorefrontCardItem({ item }: { item: CollectionItemQueryView & TCard }) {
  const graded = item?.price_key !== 'ungraded'
  return (
    <CardListView
      cardContainerStyle={
        graded
          ? {
              paddingVertical: 8,
              paddingHorizontal: 2,
              backgroundColor: Colors.$backgroundElevatedLight,
            }
          : {
              paddingVertical: 8,
              paddingHorizontal: 2,
            }
      }
      style={{ padding: 8 }}
      card={item}
      expanded={true}
      navigateTo="/profile/[shop-item]"
    />
  )
}
