import { useCardQuery } from '@/client/card'
import { useViewSingleCollectionItem } from '@/client/collections/query'
import { Offer, OfferItem, OfferStatus } from '@/client/offers/types'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { SkeletonText } from '@/components/ui/text'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { useProfiles } from '@/features/users/client/load-user'
import { UserContact } from '@/features/users/components/UserAvatars'
import { UserDisplayInfo } from '@/features/users/types'
import { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { getGradingDisplayString } from '../collection/helpers'
import { CardImage } from '../tcg-card-views/card-image'
import { getCardDisplayData, getDisplayPrice } from '../tcg-card-views/helpers'

/** Compare two cent-integer prices tolerantly (handles float drift from Postgres numeric). */
export function pricesMatch(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return false
  return Math.round(a) === Math.round(b)
}

export function PriceModifiedBadge({
  originalPrice,
  label = 'From:',
}: {
  originalPrice: number
  label?: string
}) {
  return (
    <View
      style={{
        backgroundColor: Colors.rgba(Colors.$backgroundWarningLight, 0.08),
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineWarning, 0.35),
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
      }}
    >
      <Text variant="small" style={{ color: Colors.$outlineWarning, fontSize: 12 }}>
        {label} {formatPrice(originalPrice)}
      </Text>
    </View>
  )
}

export function OfferItemRow({ item, isLast }: { item: OfferItem; isLast: boolean }) {
  const { data: collectionItem } = useViewSingleCollectionItem(item.collection_item_id ?? undefined)
  const { data: card, loading: cardLoading } = useCardQuery(item.card_snapshot?.card_id)
  const title = card?.name ?? item.card_snapshot?.title ?? 'Unknown Card'
  const setName = card?.set_name ?? item.card_snapshot?.set_name
  const displayData = getCardDisplayData({
    card,
    collectionItem,
    isLoading: cardLoading,
  })
  const subtotal = item.offered_price_per_unit * item.quantity
  // Use the listing price stored at offer time (reliable on both buyer and seller sides).
  // Fall back to live card data for older offers that predate the snapshot field.
  const listingPrice =
    item.card_snapshot?.listing_price ??
    (card ? getDisplayPrice({ card, collectionItem: collectionItem as any }) : undefined)
  const isPriceModified =
    listingPrice != null && !pricesMatch(item.offered_price_per_unit, listingPrice)

  return (
    <View
      style={[
        styles.itemRow,
        isLast && styles.itemRowLast,
        { borderBottomColor: Colors.$outlineNeutralLight },
      ]}
    >
      <CardImage displayData={displayData} width={48} isLoading={cardLoading} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="default" style={styles.itemTitle} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        {setName ? (
          <Text
            variant="info"
            className="capitalize"
            style={{ color: Colors.$textNeutralLight, fontSize: 11, lineHeight: 14 }}
          >
            {setName}
          </Text>
        ) : null}
        <Text
          variant="info"
          style={{ color: Colors.$textNeutralLight, fontSize: 11, lineHeight: 14 }}
        >
          {getGradingDisplayString(collectionItem).slice(0, 2).join(' ')}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end', gap: 2 }}>
        <Text variant="default" style={[styles.itemPrice]}>
          {formatPrice(item.offered_price_per_unit)}
        </Text>
        <Text
          variant="info"
          style={{ color: Colors.$textNeutralLight, fontSize: 11, lineHeight: 14 }}
        >
          Qty: {item.quantity}
        </Text>
        <Text
          variant="info"
          style={{ color: Colors.$textNeutralLight, fontSize: 11, lineHeight: 14 }}
        >
          Subtotal: {formatPrice(subtotal)}
        </Text>
        {isPriceModified && (
          <View style={{ alignSelf: 'flex-end' }}>
            <PriceModifiedBadge originalPrice={listingPrice ?? 0} />
          </View>
        )}
      </View>
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

export function OfferCardBase({
  offer,
  children,
  counterpartyId,
}: {
  offer: Offer
  children?: ReactNode
  counterpartyId?: string
}) {
  const items = offer.offer_items ?? []
  const computedTotal = items.reduce(
    (sum, item) => sum + item.offered_price_per_unit * item.quantity,
    0
  )
  const isTotalModified =
    offer.total_amount != null && !pricesMatch(offer.total_amount, computedTotal)
  // Default to buyer_id for the seller inbox; pass seller_id explicitly for the buyer view
  const partyId = counterpartyId ?? offer.buyer_id
  const { data: profiles } = useProfiles([partyId])
  const profile = profiles?.[partyId]
  const user: UserDisplayInfo = {
    name: profile?.display_name ?? profile?.username ?? `${partyId.slice(0, 8)}…`,
    handle: `@${profile?.username ?? partyId.slice(0, 8)}`,
    avatar: profile?.avatar_url ?? '',
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
      {/* Header: buyer info + date + status */}
      <View style={styles.cardHeader}>
        <View style={styles.buyerInfo}>
          <UserContact user={profile ? user : undefined} size="sm" />
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

      {/* Total */}
      <Separator orientation="horizontal" style={styles.separator} />
      <View style={styles.totalRow}>
        <Text variant="default" style={styles.totalLabel}>
          Total
        </Text>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text variant="default" style={styles.totalAmount}>
            {formatPrice(offer.total_amount)}
          </Text>
          {isTotalModified && <PriceModifiedBadge originalPrice={computedTotal} label="From:" />}
        </View>
      </View>

      {/* Note */}
      {offer.buyer_note ? (
        <>
          <Separator orientation="horizontal" style={styles.separator} />
          <View style={styles.noteContainer}>
            <Text variant="default" style={[styles.noteLabel, { color: Colors.$textNeutral }]}>
              Note:
            </Text>
            <Text variant="default" style={[styles.noteText, { color: Colors.$textNeutral }]}>
              {offer.buyer_note}
            </Text>
          </View>
        </>
      ) : null}

      {/* Action buttons (cancel, accept/decline, etc.) */}
      {children}
    </View>
  )
}

export function SkeletonCard() {
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
      <View style={styles.cardHeader}>
        <View style={styles.buyerInfo}>
          <UserContact size="sm" />
          <Skeleton style={{ height: 12, width: 60, borderRadius: 4 }} />
        </View>

        <Skeleton style={styles.skeletonBadge} />
      </View>

      <Separator orientation="horizontal" style={styles.separator} />

      {/* Items list */}
      {[0, 1].map((_item, idx) => (
        <View
          key={idx}
          style={[
            styles.itemRow,
            idx === 1 && styles.itemRowLast,
            { borderBottomColor: Colors.$outlineNeutralLight },
          ]}
        >
          <Skeleton style={{ width: 48, aspectRatio: 5 / 7 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <SkeletonText
              variant="default"
              style={styles.itemTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {'Placeholder Collection Item Text'}
            </SkeletonText>
            <SkeletonText
              variant="info"
              style={{ color: Colors.$textNeutralLight, lineHeight: 16 }}
            >
              {'PlaceHolder Grading'}
            </SkeletonText>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <SkeletonText variant="default" style={styles.itemPrice}>
              $~~.~~
            </SkeletonText>
            <SkeletonText variant="info" style={{ color: Colors.$textNeutralLight }}>
              Qty: ~
            </SkeletonText>
            <SkeletonText variant="small" style={{ color: Colors.$textNeutralLight }}>
              Subtotal: $~~.~~
            </SkeletonText>
          </View>
        </View>
      ))}

      <Separator orientation="horizontal" style={styles.separator} />
      <View style={styles.totalRow}>
        <SkeletonText variant="default" style={styles.totalLabel}>
          Total
        </SkeletonText>
        <SkeletonText variant="default" style={styles.totalAmount}>
          $~~~.~~
        </SkeletonText>
      </View>
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
  separator: {
    height: 1,
    marginHorizontal: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemMeta: {
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.$textNeutral,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '700',
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
  cancelText: {
    fontSize: 13,
  },
  offerDate: {
    fontSize: 12,
    marginTop: 2,
  },
  skeletonCard: {
    height: 175,
    borderRadius: 12,
    opacity: 0.3,
  },
  skeletonBadge: {
    height: 32,
    borderRadius: 6,
    width: 100,
  },
})
