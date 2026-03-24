import { useMyOffers, useUpdateOfferStatus } from '@/client/offers'
import { Offer } from '@/client/offers/types'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
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
  const { mutate: updateStatus, isPending } = useUpdateOfferStatus()
  const { showToast } = useToast()

  const handleAction = (status: 'accepted' | 'declined') => {
    updateStatus(
      { offerId: offer.id, status },
      {
        onSuccess: () => {
          showToast({
            title: status === 'accepted' ? 'Offer Accepted' : 'Offer Declined',
            message:
              status === 'accepted'
                ? 'The offer has been accepted and a transaction created.'
                : 'The offer has been declined.',
          })
        },
        onError: () => {
          showToast({
            title: 'Error',
            message: 'Failed to update offer. Please try again.',
          })
        },
      }
    )
  }

  return (
    <OfferCardBase offer={offer}>
      {offer.status === 'pending' && (
        <>
          <Separator orientation="horizontal" style={styles.separator} />
          <View style={styles.actions}>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onPress={() => handleAction('declined')}
              style={styles.actionButton}
            >
              <Text style={[styles.declineText, { color: Colors.$textDefault }]}>Decline</Text>
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isPending}
              onPress={() => handleAction('accepted')}
              style={styles.actionButton}
            >
              <Text>Accept</Text>
            </Button>
          </View>
        </>
      )}
    </OfferCardBase>
  )
}
