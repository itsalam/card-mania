import { useCardQuery } from '@/client/card'
import { useViewSingleCollectionItem } from '@/client/collections/query'
import { Button } from '@/components/ui/button'
import { NumberTicker } from '@/components/ui/number-ticker'
import { SkeletonText, Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import { useAddToCart, useOpenCart } from '@/features/cart/hooks'
import { useGetCollection } from '@/features/collection/hooks'
import { useUserProfile } from '@/features/settings/client'
import { getCardDisplayData } from '@/features/tcg-card-views/helpers'
import { UserContact } from '@/features/users/components/UserAvatars'
import { Ellipsis, X } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { BorderRadiuses, Colors, TouchableOpacity } from 'react-native-ui-lib'

import { TextField } from '@/components/ui/input/base-input'
import { Modal } from '@/components/ui/modal'
import { Separator } from '@/components/ui/separator'
import { getGradingDisplayString } from '@/features/collection/helpers'
import { useCurrency } from '@/features/settings/hooks/useCurrency'
import { Check, DollarSign } from 'lucide-react-native'

export const CollectionInfoCard = (props: { collectionItemId: string; cardId: string }) => {
  const { cardId, collectionItemId } = props
  const { data: collectionItem } = useViewSingleCollectionItem(collectionItemId)
  const { data: collectionInfo } = useGetCollection({ collectionId: collectionItem?.collection_id })
  const user = useUserProfile(collectionItem?.user_id)
  const { data: cardData } = useCardQuery(cardId)
  const [priceModalVisible, setPriceModalVisible] = useState(false)

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

  const [overridePrice, setOverridePrice] = useState<number | undefined>(undefined)

  const finalPrice = overridePrice || displayData?.displayPrice
  const [selectedQuantity, setSelectedQuantity] = useState(0)

  const addToCart = useAddToCart()
  const openCart = useOpenCart()

  const loadingInfo = !Boolean(collectionItem && collectionInfo && cardData)

  return (
    <View
      className="w-full flex gap-3"
      style={{
        borderWidth: 1,
        borderRadius: BorderRadiuses.br40,
        borderColor: Colors.$outlineDefault,
        padding: 12,
        alignSelf: 'stretch',
      }}
    >
      <View>
        <SkeletonText
          variant={'h3'}
          loading={loadingInfo}
        >{`${collectionInfo?.name}`}</SkeletonText>
        <SkeletonText variant={'info'} loading={loadingInfo}>
          {getGradingDisplayString(collectionItem).join(' ')}
        </SkeletonText>
      </View>

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
      <View
        style={{
          flexDirection: 'row',
          gap: 20,
          padding: 4,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View>
          <SkeletonText
            className="text-4xl"
            style={{
              color: Colors.$textDefault,
              opacity: loadingInfo ? 0.7 : 1,
            }}
            loading={loadingInfo}
          >
            {finalPrice ? (
              <>
                {formatPrice(finalPrice)}
                {overridePrice !== undefined && (
                  <Text
                    className="text-4xl opacity-100"
                    style={{
                      color: Colors.$textPrimary,
                    }}
                  >
                    *
                  </Text>
                )}
              </>
            ) : displayData?.displayPrice ? (
              formatPrice(displayData.displayPrice)
            ) : (
              <Text
                className="text-4xl opacity-70"
                style={{
                  color: Colors.$textDefault,
                }}
              >
                --.--
              </Text>
            )}
          </SkeletonText>
          <SkeletonText
            variant={'small'}
            className="font-medium opacity-70"
            style={{
              color: Colors.$textNeutralHeavy,
              alignSelf: 'flex-end',
            }}
            loading={loadingInfo}
          >
            {` x Qty: ${displayData?.quantity}`}
          </SkeletonText>
        </View>
        <X size={20} color={Colors.$textDefault} />
        <NumberTicker
          disabled={loadingInfo}
          containerStyle={{
            opacity: loadingInfo ? 0.6 : 1,
            height: 40,
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          }}
          min={0}
          max={collectionItem?.quantity ?? 0}
          initialNumber={loadingInfo ? undefined : selectedQuantity}
          onChangeNumber={setSelectedQuantity}
        />
        <TouchableOpacity
          onPress={() => setPriceModalVisible(true)}
          disabled={loadingInfo}
          style={{
            opacity: loadingInfo ? 0.4 : 1,
            position: 'absolute',
            right: 0,
            justifyContent: 'center',
            height: 40,
          }}
        >
          <Ellipsis color={Colors.$iconDefault} />
        </TouchableOpacity>
      </View>
      <View>
        <Button
          size={'lg'}
          disabled={loadingInfo || selectedQuantity === 0}
          onPress={() => {
            if (!collectionItem) return
            const price = finalPrice ?? 0
            addToCart({
              data: collectionItem,
              cart: {
                price,
                quantity: selectedQuantity,
                maxQuantity: collectionItem.quantity ?? 1,
              },
            })
            openCart()
          }}
        >
          <Text>Add to Deal</Text>
        </Button>
      </View>
      <OverridePriceModal
        visible={priceModalVisible}
        onDismiss={() => setPriceModalVisible(false)}
        data={{
          price: finalPrice ?? undefined,
          setPrice: setOverridePrice,
        }}
      />
    </View>
  )
}

const OverridePriceModal = ({
  visible,
  onDismiss,
  data,
}: {
  visible: boolean
  onDismiss: () => void
  data: {
    price?: number
    setPrice: (n: number) => void
  }
}) => {
  const { price, setPrice } = data
  const { symbol, multiplier, decimals } = useCurrency()
  // Convert stored integer to display units (e.g. 1999 → "19.99" for USD, 150 → "150" for TWD)
  const [priceDraft, setPriceDraft] = useState(
    price != null ? (price / multiplier).toFixed(decimals) : ''
  )
  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <View className="pt-4" style={{ paddingRight: 1, width: '100%', height: '100%' }}>
        <Separator orientation="horizontal" />

        <View className="flex flex-col flex-1 py-4" style={{ width: '100%' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              width: '100%',
              gap: 4,
              paddingBottom: 12,
            }}
          >
            <Text variant={'h3'} style={{ fontSize: 24, lineHeight: 26 }}>
              Adjust Price
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <View
              style={{
                paddingVertical: 8,
                flex: 1,
                marginLeft: 8,
              }}
            >
              <TextField
                leadingAccessory={<DollarSign color={Colors.$textDefault} />}
                validate={'number'}
                placeholder={`Price (${symbol})`}
                floatingPlaceholder
                containerStyle={{ flex: 1 }}
                value={priceDraft}
                onChangeText={(text) => setPriceDraft(text)}
              />
            </View>
          </View>
          <TouchableOpacity style={{ width: '30%', alignSelf: 'flex-end', margin: 4 }}>
            <Button
              size={'lg'}
              style={{ width: '100%', marginRight: 4 }}
              onPress={() => {
                const parsed = parseFloat(priceDraft)
                if (!isNaN(parsed)) setPrice(Math.round(parsed * multiplier))
              }}
            >
              <Text>Save</Text>
              <Check
                color={Colors.$iconDefault}
                size={16}
                strokeWidth={2}
                style={{ marginRight: 4 }}
              />
            </Button>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
