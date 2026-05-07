import { useUpdateOfferStatus } from '@/client/offers'
import { Offer } from '@/client/offers/types'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/utils/report-error'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { OfferCardBase, styles } from './ui'

export function BuyerOfferCard({ offer }: { offer: Offer }) {
  const { mutate: updateStatus, isPending } = useUpdateOfferStatus()
  const { showToast } = useToast()
  const router = useRouter()

  const handleCancel = () => {
    updateStatus(
      { offerId: offer.id, status: 'cancelled' },
      {
        onSuccess: () => {
          showToast({
            title: 'Offer Cancelled',
            message: 'Your offer has been cancelled.',
          })
        },
        onError: (err, vars) => {
          showToast({
            title: 'Error',
            message: 'Failed to cancel offer. Please try again.',
          })
          reportError({ context: 'BuyerOfferCard.handleCancel', error: err, metadata: { vars } })
        },
      }
    )
  }

  return (
    <OfferCardBase offer={offer} counterpartyId={offer.seller_id}>
      {offer.status === 'pending' && (
        <>
          <Separator orientation="horizontal" style={styles.separator} />
          <View style={styles.actions}>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onPress={handleCancel}
              style={styles.actionButton}
            >
              <Text style={[styles.cancelText, { color: Colors.$textDefault }]}>Cancel Offer</Text>
            </Button>
          </View>
        </>
      )}
      {offer.status === 'accepted' && (
        <>
          <Separator orientation="horizontal" style={styles.separator} />
          <View style={styles.actions}>
            <Button
              variant="outline"
              size="sm"
              style={styles.actionButton}
              onPress={() => router.push(`/transactions/${offer.id}`)}
            >
              <Text>View Deal</Text>
            </Button>
          </View>
        </>
      )}
    </OfferCardBase>
  )
}
