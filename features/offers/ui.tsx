import { useCardQuery } from '@/client/card'
import { useViewSingleCollectionItem } from '@/client/collections/query'
import { Offer, OfferItem, OfferStatus } from '@/client/offers/types'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { getGradingDisplayString } from '../collection/helpers'
import { useGetCollection } from '../collection/hooks'
import { useUserProfile } from '../settings/client'
import { CardImage } from '../tcg-card-views/card-image'
import { getCardDisplayData } from '../tcg-card-views/helpers'
import { UserAvatar } from '../users/components/UserAvatars'

export function OfferItemRow({ item, isLast }: { item: OfferItem; isLast: boolean }) {
  const { data: collectionItem } = useViewSingleCollectionItem(item.collection_item_id)
  const { data: card } = useCardQuery(item.card_snapshot?.card_id)
  const title = card?.name ?? 'Unknown Card'
  const displayData = getCardDisplayData({
    card,
    collectionItem,
    isLoading: !Boolean(collectionItem) || !Boolean(card),
  })

  return (
    <View
      style={[
        styles.itemRow,
        isLast && styles.itemRowLast,
        { borderBottomColor: Colors.$outlineNeutralLight },
      ]}
    >
      <CardImage displayData={displayData} width={48} />
      <View style={{ flex: 1 }}>
        <Text variant="default" style={styles.itemTitle} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        <Text variant="info" style={{ color: Colors.$textNeutralLight, lineHeight: 16 }}>
          {getGradingDisplayString(collectionItem).slice(0, 2).join(' ')}
        </Text>
      </View>

      <Text variant="default" style={[styles.itemMeta, { color: Colors.$textNeutral }]}>
        x Qty:{item.quantity} · ${item.offered_price_per_unit.toFixed(2)}/ea
      </Text>
    </View>
  )
}

export function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text variant="h3" style={[styles.emptyTitle, { color: Colors.$textNeutral }]}>
        No offers
      </Text>
      <Text variant="default" style={[styles.emptySubtitle, { color: Colors.$textNeutral }]}>
        {"You haven't submitted any offers yet."}
      </Text>
    </View>
  )
}

export function LoadingSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} style={styles.skeletonCard} />
      ))}
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

export function OfferCardBase({ offer, children }: { offer: Offer; children?: ReactNode }) {
  const { data: collection } = useGetCollection({
    collectionId: offer.title ?? offer?.offer_items?.[0] ?? undefined,
  })

  const items = offer.offer_items ?? []
  const { data: user } = useUserProfile()
  const isOwnUser = offer.buyer_id === user?.user_id

  const title = collection?.name ?? `${offer.buyer_id.slice(0, 8)}...`
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
      {/* Header: summary + status */}
      <View style={styles.cardHeader}>
        <View style={styles.buyerInfo}>
          <UserAvatar
            size={'md'}
            // style={[styles.avatarPlaceholder, { backgroundColor: Colors.$backgroundPrimaryHeavy }]}
          />
          <Text variant="h3" style={styles.offerTitle}>
            {title}
          </Text>
          <Text variant="default" style={[styles.offerDate, { color: Colors.$textNeutral }]}>
            {offer.created_at ? formatDate(offer.created_at) : ''}
          </Text>
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

      {/* Cancel for pending offers */}
      {children}
    </View>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const styles = StyleSheet.create({
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
    // paddingHorizontal: 12,
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemTitle: {
    // flex: 1,
    fontSize: 17,
    marginRight: 8,
  },
  itemMeta: {
    fontSize: 14,
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
  cancelText: {
    fontSize: 13,
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  offerDate: {
    fontSize: 12,
    marginTop: 2,
  },
})
