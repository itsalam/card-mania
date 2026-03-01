import { Text } from '@/components/ui/text'
import { formatLabel, formatPrice } from '@/components/utils'
import { useGetCollection, useGetCollectionItems } from '@/features/collection/hooks'
import { CardListView } from '@/features/tcg-card-views/ListCard'
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
        padding: 20,
      }}
    >
      {collectionId && <StorefrontPreviewItems collectionId={collectionId} />}
    </View>
  )
}

type CollectionPreviewItemProps = { collectionId: string }

function StorefrontPreviewItems({ collectionId }: CollectionPreviewItemProps) {
  const { query } = useGetCollectionItems({ collectionId }, undefined, true)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = query
  const flatData = data?.pages.flat() ?? []

  return (
    <FlatList
      horizontal
      data={flatData}
      renderItem={({ item: collectionItem }) => {
        const graded = collectionItem?.price_key !== 'ungraded'
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
            card={collectionItem}
            expanded={true}
            vertical
            renderAccessories={(props) => (
              <View
                style={{
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '100%',
                  padding: 4,
                }}
              >
                <Text variant={'large'} style={{ textAlign: 'center' }}>
                  {formatPrice(props.displayData?.displayPrice)}
                </Text>

                <Text
                  className="text-base uppercase font-spaceMono"
                  style={{ textAlign: 'center', color: Colors.$textNeutral, fontSize: 12 }}
                >
                  {formatLabel(props.displayData?.metadata, '-')}
                </Text>
              </View>
            )}
          />
        )
      }}
    />
  )
}
