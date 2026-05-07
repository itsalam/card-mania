import { OfferItem, TransactionStatus, TransactionWithOffer } from '@/client/offers/types'
import {
  useAddOfferItemsToCollection,
  useRemoveOfferItemsFromCollection,
} from '@/client/transactions'
import { useToast } from '@/components/Toast'
import { formatPrice } from '@/components/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { SkeletonText } from '@/components/ui/text'
import { Text } from '@/components/ui/text/base-text'
import { useProfiles } from '@/features/users/client/load-user'
import { UserContact } from '@/features/users/components/UserAvatars'
import { UserDisplayInfo } from '@/features/users/types'
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Package,
  ShoppingBag,
  Square,
} from 'lucide-react-native'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useState } from 'react'
import { Colors } from 'react-native-ui-lib'

// ── Status timeline ───────────────────────────────────────────────────────────

const STEPS: { key: TransactionStatus; label: string }[] = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'completed', label: 'Received' },
]

const STEP_INDEX: Record<string, number> = {
  pending: 0,
  shipped: 1,
  completed: 2,
  disputed: -1,
}

export function TransactionStatusTimeline({ status }: { status: TransactionStatus }) {
  const currentIdx = STEP_INDEX[status] ?? 0

  if (status === 'disputed') {
    return (
      <View style={timelineStyles.disputedBanner}>
        <AlertTriangle size={16} color={Colors.$outlineWarning} />
        <Text variant="default" style={{ color: Colors.$outlineWarning, fontWeight: '600' }}>
          This transaction is under review
        </Text>
      </View>
    )
  }

  return (
    <View style={[timelineStyles.container, { paddingTop: 24 }]}>
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx
        const isActive = idx === currentIdx
        return (
          <View key={step.key} style={timelineStyles.step}>
            <View
              style={[
                timelineStyles.dot,
                isDone && { backgroundColor: Colors.$backgroundSuccessHeavy },
                isActive && { backgroundColor: Colors.$backgroundPrimaryHeavy },
                !isDone && !isActive && { backgroundColor: Colors.$backgroundNeutralMedium },
              ]}
            >
              {isDone ? (
                <Check size={12} color="#fff" strokeWidth={3} />
              ) : isActive ? (
                <Package size={12} color="#fff" />
              ) : null}
            </View>
            <Text
              variant="info"
              style={[
                timelineStyles.stepLabel,
                isActive && { color: Colors.$textDefault, fontWeight: '600' },
                isDone && { color: Colors.$textNeutral },
                !isDone && !isActive && { color: Colors.$textNeutralLight },
              ]}
            >
              {step.label}
            </Text>
            {idx < STEPS.length - 1 && (
              <View
                style={[
                  timelineStyles.connector,
                  idx < currentIdx
                    ? { backgroundColor: Colors.$backgroundSuccessHeavy }
                    : { backgroundColor: Colors.$backgroundNeutralMedium },
                ]}
              />
            )}
          </View>
        )
      })}
    </View>
  )
}

const timelineStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 0,
  },
  step: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepLabel: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 11,
  },
  connector: {
    position: 'absolute',
    top: 14,
    left: '50%',
    right: '-50%',
    height: 2,
    zIndex: 0,
  },
  disputedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.rgba(Colors.$outlineWarning, 0.12),
  },
})

// ── Parties ───────────────────────────────────────────────────────────────────

export function TransactionParties({
  buyerId,
  sellerId,
  currentUserId,
}: {
  buyerId: string
  sellerId: string
  currentUserId: string | undefined
}) {
  const { data: profiles } = useProfiles([buyerId, sellerId])

  const makeUser = (id: string): UserDisplayInfo | undefined => {
    const p = profiles?.[id]
    if (!p) return undefined
    return {
      name: p.display_name ?? p.username ?? id.slice(0, 8),
      handle: `@${p.username ?? id.slice(0, 8)}`,
      avatar: p.avatar_url ?? '',
    }
  }

  return (
    <View style={partyStyles.container}>
      <PartyCard label="Buyer" user={makeUser(buyerId)} isYou={currentUserId === buyerId} />
      <ShoppingBag size={26} color={Colors.$iconNeutral} />
      <PartyCard label="Seller" user={makeUser(sellerId)} isYou={currentUserId === sellerId} />
    </View>
  )
}

function PartyCard({
  label,
  user,
  isYou,
}: {
  label: string
  user: UserDisplayInfo | undefined
  isYou: boolean
}) {
  return (
    <View style={partyStyles.party}>
      <View style={partyStyles.labelRow}>
        <Text variant="info" style={{ color: Colors.$textNeutralLight }}>
          {label}
        </Text>
        {isYou && (
          <Badge
            label="You"
            variant="square"
            size={{ height: 18 }}
            backgroundColor={Colors.$backgroundPrimaryHeavy}
            labelStyle={{ fontSize: 10 }}
          />
        )}
      </View>
      <UserContact user={user} size="md" variant="outline" />
    </View>
  )
}

const partyStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  party: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
})

// ── Action buttons ─────────────────────────────────────────────────────────────

export function TransactionActionButtons({
  isSeller,
  status,
  isPending,
  showDispute = false,
  onMarkShipped,
  onConfirmReceipt,
  onDispute,
}: {
  isSeller: boolean
  status: TransactionStatus
  isPending: boolean
  showDispute?: boolean
  onMarkShipped: () => void
  onConfirmReceipt: () => void
  onDispute: () => void
}) {
  const isTerminal = status === 'completed' || status === 'disputed'
  const showMarkedShipped = isSeller && status === 'pending'
  const showConfirmReceipt = !isSeller && status === 'shipped'
  const isEmpty = !(showConfirmReceipt || showConfirmReceipt || showDispute)
  if (isTerminal || isEmpty) return null

  return (
    <View style={actionStyles.container}>
      {showMarkedShipped && (
        <Button
          size="lg"
          variant="primary"
          disabled={isPending}
          onPress={onMarkShipped}
          style={actionStyles.button}
        >
          <Text>Mark as Shipped</Text>
        </Button>
      )}
      {showConfirmReceipt && (
        <Button
          size="lg"
          variant="primary"
          disabled={isPending}
          onPress={onConfirmReceipt}
          style={actionStyles.button}
        >
          <Text>Confirm Receipt</Text>
        </Button>
      )}
      {showDispute && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onPress={onDispute}
          style={actionStyles.button}
        >
          <Text style={{ color: Colors.$textDanger }}>Open Dispute</Text>
        </Button>
      )}
    </View>
  )
}

const actionStyles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 16,
  },
  button: {
    width: '100%',
  },
})

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function TransactionSkeletonCard() {
  return (
    <View style={skeletonStyles.container}>
      <View style={skeletonStyles.partiesRow}>
        <Skeleton style={skeletonStyles.avatar} />
        <Skeleton style={skeletonStyles.connector} />
        <Skeleton style={skeletonStyles.avatar} />
      </View>
      <View style={skeletonStyles.timeline}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={skeletonStyles.timelineStep}>
            <Skeleton style={skeletonStyles.dot} />
            <Skeleton style={skeletonStyles.stepLabel} />
          </View>
        ))}
      </View>
      <Separator orientation="horizontal" />
      {[0, 1].map((i) => (
        <View key={i} style={skeletonStyles.itemRow}>
          <Skeleton style={skeletonStyles.cardThumb} />
          <View style={{ flex: 1, gap: 4 }}>
            <SkeletonText variant="default" placeholderTextLength={20} />
            <SkeletonText variant="info" placeholderTextLength={14} />
          </View>
          <SkeletonText variant="default" placeholderTextLength={6} />
        </View>
      ))}
    </View>
  )
}

const skeletonStyles = StyleSheet.create({
  container: { gap: 4 },
  partiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 16,
  },
  avatar: { width: 80, height: 48, borderRadius: 8 },
  connector: { flex: 1, height: 2, marginHorizontal: 8 },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  timelineStep: { alignItems: 'center', gap: 6 },
  dot: { width: 28, height: 28, borderRadius: 14 },
  stepLabel: { width: 60, height: 12, borderRadius: 4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  cardThumb: { width: 48, aspectRatio: 5 / 7 },
})

// ── Collection sync tick ──────────────────────────────────────────────────────

export function CollectionSyncTick({ isBuyer, items }: { isBuyer: boolean; items: OfferItem[] }) {
  const [synced, setSynced] = useState(false)
  const { mutate: addToCollection, isPending: isAdding } = useAddOfferItemsToCollection()
  const { mutate: removeFromCollection, isPending: isRemoving } =
    useRemoveOfferItemsFromCollection()
  const { showToast } = useToast()
  const isPending = isAdding || isRemoving

  // Seller: items already decremented from their selling collection by DB trigger
  if (!isBuyer) {
    return (
      <View style={tickStyles.row}>
        <CheckSquare size={16} color={Colors.$backgroundSuccessHeavy} />
        <Text variant="small" style={tickStyles.labelDone}>
          Removed from selling collection
        </Text>
      </View>
    )
  }

  const handleToggle = () => {
    if (isPending) return
    if (synced) {
      removeFromCollection(
        { items },
        {
          onSuccess: () => {
            setSynced(false)
            showToast({ title: 'Removed from collection', message: '' })
          },
          onError: () =>
            showToast({ title: 'Error', message: 'Could not remove from collection.' }),
        }
      )
    } else {
      addToCollection(
        { items },
        {
          onSuccess: () => {
            setSynced(true)
            showToast({ title: 'Added to collection', message: '' })
          },
          onError: () => showToast({ title: 'Error', message: 'Could not add to collection.' }),
        }
      )
    }
  }

  return (
    <TouchableOpacity
      onPress={handleToggle}
      activeOpacity={0.7}
      style={tickStyles.row}
      disabled={isPending}
    >
      {synced ? (
        <CheckSquare size={16} color={Colors.$backgroundSuccessHeavy} />
      ) : (
        <Square size={16} color={Colors.$iconNeutral} />
      )}
      <Text variant="small" style={synced ? tickStyles.labelDone : tickStyles.label}>
        {isPending ? (synced ? 'Removing…' : 'Adding…') : 'Reflect changes in my collection'}
      </Text>
    </TouchableOpacity>
  )
}

const tickStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: Colors.$textNeutralLight,
    fontSize: 13,
  },
  labelDone: {
    color: Colors.$backgroundSuccessHeavy,
    fontSize: 13,
    fontWeight: '500',
  },
})

// ── Transaction list card ─────────────────────────────────────────────────────

const STATUS_LABEL: Record<TransactionStatus, string> = {
  pending: 'Pending',
  shipped: 'Shipped',
  completed: 'Completed',
  disputed: 'Disputed',
}

const STATUS_COLOR: Record<TransactionStatus, string> = {
  pending: Colors.$backgroundNeutralMedium,
  shipped: Colors.$backgroundPrimaryHeavy,
  completed: Colors.$backgroundSuccessHeavy,
  disputed: Colors.$outlineWarning,
}

export function TransactionListCard({
  transaction,
  currentUserId,
  onPress,
}: {
  transaction: TransactionWithOffer
  currentUserId: string | undefined
  onPress: () => void
}) {
  const offer = transaction.offer
  const isSeller = offer.seller_id === currentUserId
  const counterpartyId = isSeller ? offer.buyer_id : offer.seller_id
  const { data: profiles } = useProfiles([counterpartyId])
  const counterparty = profiles?.[counterpartyId]
  const counterpartyUser: UserDisplayInfo | undefined = counterparty
    ? {
        name: counterparty.display_name ?? counterparty.username ?? counterpartyId.slice(0, 8),
        handle: `@${counterparty.username ?? counterpartyId.slice(0, 8)}`,
        avatar: counterparty.avatar_url ?? '',
      }
    : undefined

  const itemCount = offer.offer_items?.length ?? 0
  const statusColor =
    STATUS_COLOR[transaction.status as TransactionStatus] ?? Colors.$backgroundNeutralMedium

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={listCardStyles.container}>
      <View style={listCardStyles.row}>
        <UserContact user={counterpartyUser} size="sm" />
        <View style={listCardStyles.meta}>
          <View style={listCardStyles.statusRow}>
            <View style={[listCardStyles.statusDot, { backgroundColor: statusColor }]} />
            <Text variant="small" style={[listCardStyles.statusLabel, { color: statusColor }]}>
              {STATUS_LABEL[transaction.status as TransactionStatus] ?? transaction.status}
            </Text>
            <Text variant="muted" style={listCardStyles.role}>
              {isSeller ? '· Selling' : '· Buying'}
            </Text>
          </View>
          <Text variant="muted" style={listCardStyles.detail}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatPrice(offer.total_amount)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const listCardStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.$outlineDefault,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontWeight: '600',
    fontSize: 13,
  },
  role: {
    fontSize: 12,
    color: Colors.$textNeutralLight,
  },
  detail: {
    fontSize: 12,
    color: Colors.$textNeutralLight,
  },
})
