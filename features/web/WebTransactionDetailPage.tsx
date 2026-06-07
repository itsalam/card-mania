import {
  useTransaction,
  useUpdateTransactionStatus,
  useConfirmShippingAddress,
  useTransactionStatusRealtime,
} from '@/client/transactions'
import {
  useTransactionMessages,
  useSendTransactionMessage,
  useTransactionMessageRealtime,
} from '@/client/transactions/messages'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import {
  TransactionActionButtons,
  TransactionParties,
  TransactionStatusTimeline,
} from '@/features/transactions/ui'
import { useUserStore } from '@/lib/store/useUserStore'
import { Link, useLocalSearchParams } from 'expo-router'
import { Send } from 'lucide-react-native'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { GradientBackground } from '@/components/Background'
import { AuthModal } from './AuthModal'
import { useWebUser } from './hooks/useWebUser'
import { NAV_CLEARANCE, NAV_TOP } from './layout-constants'
import { WebNav } from './WebNav'

export default function WebTransactionDetailPage() {
  const { offerId } = useLocalSearchParams<{ offerId: string }>()
  const { width } = useWindowDimensions()
  const isPortrait = width < 768
  const currentUser = useWebUser()
  const userId = useUserStore((s) => s.user?.id)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [navQuery, setNavQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [message, setMessage] = useState('')
  const chatScrollRef = useRef<ScrollView>(null)

  const { data: transaction, isLoading } = useTransaction(offerId)
  useTransactionStatusRealtime(offerId)

  const { data: messages = [] } = useTransactionMessages(transaction?.id)
  useTransactionMessageRealtime(transaction?.id)

  const updateStatus = useUpdateTransactionStatus()
  const sendMessage = useSendTransactionMessage()
  const confirmShipping = useConfirmShippingAddress()

  if (!currentUser) {
    return (
      <GradientBackground style={{ flex: 1 }}>
        <WebNav
          currentUser={null}
          scrolled={scrolled}
          onSignInPress={() => setShowAuthModal(true)}
        />
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text variant="h2">Sign in to view this transaction</Text>
          <Pressable
            onPress={() => setShowAuthModal(true)}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: Colors.$backgroundPrimaryHeavy,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Sign in</Text>
          </Pressable>
        </View>
      </GradientBackground>
    )
  }

  return (
    <GradientBackground style={{ flex: 1 }}>
      <WebNav
        currentUser={currentUser}
        scrolled={scrolled}
        searchQuery={navQuery}
        onSearchChange={setNavQuery}
        onSignInPress={() => setShowAuthModal(true)}
      />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: isPortrait ? 8 : NAV_CLEARANCE + NAV_TOP,
          paddingBottom: 60,
        }}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 10)}
        scrollEventThrottle={16}
      >
        <View
          style={{
            maxWidth: 720,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: 16,
            gap: 20,
          }}
        >
          {/* Back */}
          <Link href="/transactions">
            <Text variant="muted" style={{ fontSize: 13, paddingTop: 8 }}>
              ← Transactions
            </Text>
          </Link>

          {isLoading || !transaction ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <>
              <Text variant="h1" style={{ fontSize: 24, fontWeight: '700' }}>
                Transaction
              </Text>

              {/* Status timeline */}
              <SectionCard label="Status">
                <TransactionStatusTimeline status={transaction.status} />
              </SectionCard>

              {/* Parties */}
              <SectionCard label="Parties">
                <TransactionParties
                  buyerId={transaction.offer.buyer_id}
                  sellerId={transaction.offer.seller_id}
                  currentUserId={userId}
                />
              </SectionCard>

              {/* Items */}
              <SectionCard label="Items">
                <View style={{ gap: 8 }}>
                  {(transaction.offer?.offer_items ?? []).map((item: any) => (
                    <View
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '500' }}>
                          {item.card_snapshot?.title ?? '—'}
                        </Text>
                        <Text variant="muted" style={{ fontSize: 12 }}>
                          Qty: {item.quantity}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: '600' }}>
                        {formatPrice(item.offered_price_per_unit * item.quantity)}
                      </Text>
                    </View>
                  ))}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      borderTopWidth: 1,
                      borderTopColor: Colors.$outlineNeutralLight,
                      paddingTop: 8,
                    }}
                  >
                    <Text style={{ fontWeight: '600' }}>Total</Text>
                    <Text style={{ fontWeight: '700' }}>
                      {formatPrice(transaction.offer?.total_amount ?? 0)}
                    </Text>
                  </View>
                </View>
              </SectionCard>

              {/* Actions */}
              <TransactionActionButtons
                isSeller={transaction.offer.seller_id === userId}
                status={transaction.status}
                isPending={updateStatus.isPending || confirmShipping.isPending}
                showDispute
                onMarkShipped={() =>
                  updateStatus.mutate({ offerId: transaction.offer_id, status: 'shipped' })
                }
                onConfirmReceipt={() =>
                  updateStatus.mutate({ offerId: transaction.offer_id, status: 'completed' })
                }
                onDispute={() =>
                  updateStatus.mutate({ offerId: transaction.offer_id, status: 'disputed' })
                }
              />

              {/* Chat */}
              <SectionCard label="Messages">
                <ScrollView
                  ref={chatScrollRef}
                  style={{ maxHeight: 320 }}
                  onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
                >
                  <View style={{ gap: 8, padding: 4 }}>
                    {messages.length === 0 && (
                      <Text variant="muted" style={{ textAlign: 'center', paddingVertical: 16 }}>
                        No messages yet.
                      </Text>
                    )}
                    {messages.map((msg: any) => {
                      const isMe = msg.sender_id === userId
                      return (
                        <View key={msg.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <View
                            style={{
                              maxWidth: '75%',
                              backgroundColor: isMe
                                ? Colors.$backgroundPrimaryHeavy
                                : Colors.$backgroundElevated,
                              borderRadius: 12,
                              padding: 10,
                            }}
                          >
                            <Text
                              style={{ color: isMe ? '#fff' : Colors.$textDefault, fontSize: 14 }}
                            >
                              {msg.content}
                            </Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </ScrollView>

                {/* Message input */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Send a message…"
                    placeholderTextColor={Colors.$textNeutralLight}
                    style={
                      {
                        flex: 1,
                        borderWidth: 1,
                        borderColor: Colors.$outlineNeutral,
                        borderRadius: 20,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        fontSize: 14,
                        color: Colors.$textDefault,
                        outlineStyle: 'none',
                      } as any
                    }
                    onSubmitEditing={() => {
                      if (!message.trim()) return
                      sendMessage.mutate({
                        transactionId: transaction.id,
                        senderId: userId ?? '',
                        content: message.trim(),
                      })
                      setMessage('')
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      if (!message.trim()) return
                      sendMessage.mutate({
                        transactionId: transaction.id,
                        senderId: userId ?? '',
                        content: message.trim(),
                      })
                      setMessage('')
                    }}
                    style={{ padding: 8 }}
                  >
                    <Send size={18} color={Colors.$backgroundPrimaryHeavy} />
                  </Pressable>
                </View>
              </SectionCard>
            </>
          )}
        </View>
      </ScrollView>
    </GradientBackground>
  )
}

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: Colors.$outlineNeutral,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: Colors.$outlineNeutralLight,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: Colors.$textNeutral,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ padding: 16 }}>{children}</View>
    </View>
  )
}
