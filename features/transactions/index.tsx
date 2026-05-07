import {
  useTransaction,
  useTransactionStatusRealtime,
  useUpdateTransactionStatus,
} from '@/client/transactions'
import {
  useTransactionMessageRealtime,
  useTransactionMessages,
} from '@/client/transactions/messages'
import { useToast } from '@/components/Toast'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { FEATURES } from '@/constants/features'
import { OfferItemRow } from '@/features/offers/ui'
import { useRefresh } from '@/lib/hooks/useRefresh'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { useEffect, useRef } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BorderRadiuses, Colors, TouchableOpacity } from 'react-native-ui-lib'
import { ChatInputBar, TransactionChatSection } from './chat'
import { ShippingAddressSection } from './shipping-address'
import {
  CollectionSyncTick,
  TransactionActionButtons,
  TransactionParties,
  TransactionSkeletonCard,
  TransactionStatusTimeline,
} from './ui'

export function TransactionScreen({ offerId }: { offerId: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { showToast } = useToast()
  const currentUserId = useUserStore((s) => s.user?.id)
  const scrollRef = useRef<ScrollView>(null)

  const { data, isLoading, refetch: refetchTransaction } = useTransaction(offerId)
  const { refetch: refetchMessages } = useTransactionMessages(data?.id)
  const { mutate: updateStatus, isPending } = useUpdateTransactionStatus()

  // Realtime subscriptions
  useTransactionStatusRealtime(offerId)
  useTransactionMessageRealtime(data?.id)

  // Pull-to-refresh
  const { refreshing, onRefresh } = useRefresh([refetchTransaction, refetchMessages])

  const offer = data?.offer
  const isSeller = Boolean(offer && currentUserId && offer.seller_id === currentUserId)
  const otherUserId = offer ? (isSeller ? offer.buyer_id : offer.seller_id) : undefined
  const items = offer?.offer_items ?? []

  useEffect(() => {
    if (data?.id) {
      const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
      return () => clearTimeout(timer)
    }
  }, [data?.id])

  const handleUpdate = (status: Parameters<typeof updateStatus>[0]['status'], label: string) => {
    updateStatus(
      { offerId, status },
      {
        onSuccess: () => showToast({ title: label, message: '' }),
        onError: () =>
          showToast({ title: 'Error', message: 'Failed to update. Please try again.' }),
      }
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.$iconDefault} />
          </TouchableOpacity>
          <Text variant="h3" style={styles.title}>
            Transaction
          </Text>
          <View style={styles.backButton} />
        </View>

        <Separator orientation="horizontal" />

        {isLoading || !data || !offer ? (
          <ScrollView contentContainerStyle={styles.content}>
            <TransactionSkeletonCard />
          </ScrollView>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.content}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              {/* Parties */}
              <CollapsibleSection title="Parties">
                <TransactionParties
                  buyerId={offer.buyer_id}
                  sellerId={offer.seller_id}
                  currentUserId={currentUserId}
                />
              </CollapsibleSection>

              <Separator orientation="horizontal" />

              {/* Status timeline */}
              <CollapsibleSection title="Status">
                <TransactionStatusTimeline status={data.status} />
              </CollapsibleSection>

              <Separator orientation="horizontal" />

              {/* Shipping address */}
              <CollapsibleSection title="Shipping Address">
                <ShippingAddressSection
                  offerId={offerId}
                  isBuyer={!isSeller}
                  confirmedAddress={data.buyer_shipping_address}
                />
              </CollapsibleSection>

              <Separator orientation="horizontal" />
              {/* Deal Items */}
              <CollapsibleSection
                title="Deal Items"
                rightElement={
                  <Text variant="muted" style={styles.itemCount}>
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </Text>
                }
              >
                {items.map((item, idx) => (
                  <OfferItemRow key={item.id} item={item} isLast={idx === items.length - 1} />
                ))}
                <Separator orientation="horizontal" />
              </CollapsibleSection>

              {/* Chat */}
              {otherUserId && (
                <TransactionChatSection
                  transactionId={data.id}
                  currentUserId={currentUserId}
                  otherUserId={otherUserId}
                />
              )}
            </ScrollView>
            <View style={[styles.footerSection, { borderColor: Colors.$outlineDefault }]}>
              <View style={styles.totalRow}>
                <Text variant="default" style={styles.totalLabel}>
                  Total
                </Text>
                <Text variant="default" style={styles.totalAmount}>
                  {formatPrice(offer.total_amount)}
                </Text>
              </View>
              {data.status === 'completed' && (
                <View style={styles.syncTickRow}>
                  <CollectionSyncTick isBuyer={!isSeller} items={items} />
                </View>
              )}
              <TransactionActionButtons
                isSeller={isSeller}
                status={data.status}
                isPending={isPending}
                showDispute={FEATURES.disputes}
                onMarkShipped={() => handleUpdate('shipped', 'Marked as Shipped')}
                onConfirmReceipt={() => handleUpdate('completed', 'Deal Complete!')}
                onDispute={() => handleUpdate('disputed', 'Dispute Opened')}
              />
              {/* Pinned input bar */}
              <ChatInputBar
                transactionId={data.id}
                currentUserId={currentUserId}
                insetBottom={insets.bottom}
              />
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.$backgroundDefault,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
  },
  content: {
    paddingBottom: 16,
  },
  itemCount: {
    color: Colors.$textNeutralLight,
    fontSize: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  footerSection: {
    borderWidth: 2,
    borderRadius: BorderRadiuses.br50,
  },
  syncTickRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
})
