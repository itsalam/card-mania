import { useCardQuery } from '@/client/card'
import { useViewSingleCollectionItem } from '@/client/collections/query'
import { SkeletonText, Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import { useGetCollection } from '@/features/collection/hooks'
import { useUserProfile } from '@/features/settings/client'
import { getCardDisplayData } from '@/features/tcg-card-views/helpers'
import { UserContact } from '@/features/users/components/UserAvatars'
import React, { useMemo } from 'react'
import { View } from 'react-native'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'

export const CollectionInfoCard = (props: { collectionItemId: string; cardId: string }) => {
  const { cardId, collectionItemId } = props
  const { data: collectionItem } = useViewSingleCollectionItem(collectionItemId)
  const { data: collectionInfo } = useGetCollection({ collectionId: collectionItem?.collection_id })
  const user = useUserProfile(collectionItem?.user_id)
  const { data: cardData } = useCardQuery(cardId)

  const displayData = useMemo(
    () =>
      getCardDisplayData({
        card: cardData,
        collectionItem: collectionItem,
        metadata: {
          price_key: collectionItem?.grade_condition
            ? `${collectionItem?.grading_company}${collectionItem?.grade_condition?.grade_value}`
            : 'ungraded',
        },
      }),
    [cardData, collectionItem]
  )
  console.log({ displayData, collectionItem })
  return (
    <View
      className="w-full flex gap-3"
      style={{
        borderWidth: 1,
        borderRadius: BorderRadiuses.br40,
        borderColor: Colors.$outlineDefault,
        padding: 12,
      }}
    >
      <SkeletonText
        variant={'h4'}
        loading={!Boolean(collectionInfo)}
      >{`${collectionInfo?.name}`}</SkeletonText>
      <UserContact
        user={
          user.data
            ? {
                name: user.data?.display_name ?? '',
                handle: user.data?.username ?? '',
                avatar: user.data?.avatar_url ?? '',
              }
            : undefined
        }
      />
      <Text variant={'info'}>
        <SkeletonText
          className="text-3xl"
          style={{
            color: Colors.$textDefault,
            opacity: !Boolean(collectionItem) ? 0.7 : 1,
          }}
          loading={!Boolean(collectionItem)}
        >
          {displayData?.displayPrice ? (
            formatPrice(displayData.displayPrice)
          ) : (
            <Text
              className="text-3xl opacity-70"
              style={{
                color: Colors.$textDefault,
              }}
            >
              $-.--
            </Text>
          )}
        </SkeletonText>

        <SkeletonText
          variant={'small'}
          className="font-medium opacity-70"
          style={{
            color: Colors.$textNeutralHeavy,
          }}
          loading={!displayData?.quantity}
        >
          {` x Qty: ${displayData?.quantity}`}
        </SkeletonText>
      </Text>
    </View>
  )
}
