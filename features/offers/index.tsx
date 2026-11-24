import { useMyOffers } from '@/client/offers'
import { Offer } from '@/client/offers/types'
import { ScrollView, View } from 'react-native'
import { OfferActions, OfferHistory, OfferTurnStrip } from './negotiation'
import { EmptyState, LoadingSkeleton, OfferCardBase, styles } from './ui'

export function OfferInboxPage() {
  const { data: offers, isLoading } = useMyOffers('seller')
  const list = offers ?? []

  return (
    <View style={styles.container}>
      {isLoading ? (
        <LoadingSkeleton />
      ) : list.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {list.map((offer) => (
            <InboxOfferCard key={offer.id} offer={offer} />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

export function InboxOfferCard({ offer }: { offer: Offer }) {
  return (
    <OfferCardBase
      offer={offer}
      afterHeader={<OfferTurnStrip offer={offer} role="seller" />}
      history={<OfferHistory offer={offer} role="seller" />}
    >
      <OfferActions offer={offer} role="seller" />
    </OfferCardBase>
  )
}
