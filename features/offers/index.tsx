import { useMyOffers, useUpdateOfferStatus } from '@/client/offers'
import { Offer, OfferItem, OfferStatus } from '@/client/offers/types'
import { useToast } from '@/components/Toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

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
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

function StatusBadge({ status }: { status: OfferStatus }) {
  const colors: Record<OfferStatus, string> = {
    pending: Colors.$backgroundSuccessHeavy,
    accepted: Colors.$backgroundSuccessLight,
    declined: Colors.$backgroundDangerLight,
    cancelled: Colors.$backgroundNeutralMedium,
    completed: Colors.$backgroundSuccessLight,
  }

  const labels: Record<OfferStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    declined: 'Declined',
    cancelled: 'Cancelled',
    completed: 'Completed',
  }

  return (
    <Badge
      label={labels[status]}
      backgroundColor={colors[status] ?? Colors.$backgroundNeutral}
      variant="square"
    />
  )
}

export function OfferCard({ offer }: { offer: Offer }) {
  const { mutate: updateStatus, isPending } = useUpdateOfferStatus()
  const { showToast } = useToast()
  const items = offer.offer_items ?? []

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
    <View
      style={[
        styles.card,
        {
          backgroundColor: Colors.$backgroundElevated,
          borderColor: Colors.$outlineNeutral,
        },
      ]}
    >
      {/* Header: buyer + status */}
      <View style={styles.cardHeader}>
        <View style={styles.buyerInfo}>
          <View
            style={[styles.avatarPlaceholder, { backgroundColor: Colors.$backgroundPrimaryHeavy }]}
          >
            <Text style={[styles.avatarText, { color: Colors.$textDefault }]}>
              {offer.buyer_id.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text variant="h3" style={styles.buyerName}>
              {offer.buyer_id.slice(0, 8)}…
            </Text>
            <Text variant="default" style={[styles.offerMeta, { color: Colors.$textNeutral }]}>
              {items.length} item{items.length !== 1 ? 's' : ''} · ${offer.total_amount.toFixed(2)}
            </Text>
          </View>
        </View>
        <StatusBadge status={offer.status} />
      </View>

      <Separator orientation="horizontal" style={styles.separator} />

      {/* Items list */}
      {items.map((item, idx) => (
        <OfferItemRow key={item.id} item={item} isLast={idx === items.length - 1} />
      ))}

      {/* Note */}
      {offer.buyer_note ? (
        <View style={styles.noteContainer}>
          <Text variant="default" style={[styles.noteLabel, { color: Colors.$textNeutral }]}>
            Note:
          </Text>
          <Text variant="default" style={[styles.noteText, { color: Colors.$textNeutral }]}>
            {offer.buyer_note}
          </Text>
        </View>
      ) : null}

      {/* Actions for pending offers */}
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
    </View>
  )
}

function OfferItemRow({ item, isLast }: { item: OfferItem; isLast: boolean }) {
  const title = item.card_snapshot?.title ?? 'Unknown Card'
  return (
    <View
      style={[
        styles.itemRow,
        isLast && styles.itemRowLast,
        { borderBottomColor: Colors.$outlineNeutralLight },
      ]}
    >
      <Text variant="default" style={styles.itemTitle} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      <Text variant="default" style={[styles.itemMeta, { color: Colors.$textNeutral }]}>
        x{item.quantity} · ${item.offered_price_per_unit.toFixed(2)}/ea
      </Text>
    </View>
  )
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text variant="h3" style={[styles.emptyTitle, { color: Colors.$textNeutral }]}>
        No offers
      </Text>
      <Text variant="default" style={[styles.emptySubtitle, { color: Colors.$textNeutral }]}>
        {"You don't have any offers right now."}
      </Text>
    </View>
  )
}

function LoadingSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} style={styles.skeletonCard} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  list: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  buyerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  buyerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  offerMeta: {
    fontSize: 12,
  },
  separator: {
    height: 1,
    marginHorizontal: 0,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemTitle: {
    flex: 1,
    fontSize: 13,
    marginRight: 8,
  },
  itemMeta: {
    fontSize: 12,
  },
  noteContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 4,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  noteText: {
    fontSize: 12,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  actionButton: {
    flex: 1,
  },
  declineText: {
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  skeletonCard: {
    height: 120,
    borderRadius: 12,
  },
})
