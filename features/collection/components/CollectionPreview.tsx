import { SkeletonView } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { formatLabel, formatPrice } from '@/components/utils'
import { CardListView } from '@/features/tcg-card-views/ListCard'
import { View } from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { useGetCollection, useGetCollectionItems } from '../hooks'
import CollectionScreen from '../pages'

type CollectionPreviewProps = { collectionId?: string }

export function CollectionPreview({ collectionId }: CollectionPreviewProps) {
  const { data: collection } = useGetCollection({ collectionId })
  const isLoading = !collectionId || !CollectionScreen
  return (
    <View
      style={{
        borderRadius: BorderRadiuses.br40,
        backgroundColor: Colors.$backgroundElevated,
        padding: 20,
      }}
    >
      <View style={{ paddingHorizontal: 12 }}>
        <SkeletonView loading={isLoading}>
          <Text variant={'h3'}>{collection?.name}</Text>
        </SkeletonView>
        <SkeletonView loading={isLoading}>
          <Text variant={'default'} numberOfLines={1} ellipsizeMode="tail">
            {collection?.description}
          </Text>
        </SkeletonView>
      </View>
      {collectionId && <CollectPreviewItems collectionId={collectionId} />}
    </View>
  )
}

type CollectionPreviewItemProps = { collectionId: string }

function CollectPreviewItems({ collectionId }: CollectionPreviewItemProps) {
  const { query } = useGetCollectionItems({ collectionId })
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = query
  const flatData = data?.pages.flat() ?? []
  console.log(flatData[0])
  return (
    <FlatList
      contentContainerStyle={{ width: '100%', flex: 1 }}
      horizontal
      data={flatData}
      renderItem={({ item: collectionItem }) => {
        const graded = collectionItem.price_key !== 'ungraded'
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
