// ITS-140/142/143: the negotiation parts of an offer card: whose move it is, time left,
// the history of proposals, and the actions (accept / counter / decline / cancel).
//
// Design refs (Mobbin): eBay "Offer" sheet — expiry line, message, and stacked
// checkout / counteroffer / decline actions
// (https://mobbin.com/screens/616ba8e1-0340-4539-8bb0-03622773982a); GOAT offer modal —
// expiry countdown pill ("1D 16H 47M") (https://mobbin.com/screens/5f02bf42-d8c2-4612-8c88-a935005e47fc).
// Full notes: docs/offers/state-machine.md.

import { useCounterOffer, useUpdateOfferStatus } from '@/client/offers'
import {
  OfferRole,
  effectiveOfferStatus,
  formatTimeLeft,
  isMyTurn,
  offerResponder,
} from '@/client/offers/state'
import { Offer, OfferRevision } from '@/client/offers/types'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { centsToInputString, formatPrice, inputStringToCents } from '@/components/utils'
import { useRouter } from 'expo-router'
import { Clock } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { styles as cardStyles } from './ui'

/** Re-renders every `intervalMs` so countdowns stay current. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function errorMessage(err: unknown, fallback: string) {
  const msg = (err as { message?: string } | null)?.message
  return msg && msg.length < 160 ? msg : fallback
}

// ── turn + expiry strip ─────────────────────────────────────────────────────

export function OfferTurnStrip({ offer, role }: { offer: Offer; role: OfferRole }) {
  const now = useNow()
  const status = effectiveOfferStatus(offer, now)
  const responder = offerResponder(status)
  if (!responder) return null

  const myTurn = responder === role
  const timeLeft = formatTimeLeft(offer.expires_at, now)
  const label = myTurn
    ? status === 'countered'
      ? 'The seller countered: your move'
      : offer.offer_revisions && offer.offer_revisions.length > 1
        ? 'The buyer countered: your move'
        : 'Your move'
    : `Waiting on the ${responder}`

  return (
    <>
      <Separator orientation="horizontal" style={cardStyles.separator} />
      <View style={localStyles.turnRow}>
        <Text
          variant="default"
          style={[
            localStyles.turnLabel,
            { color: myTurn ? Colors.$textDefault : Colors.$textNeutral },
          ]}
        >
          {label}
        </Text>
        {timeLeft ? (
          <View
            style={[
              localStyles.expiryPill,
              {
                backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.15),
                borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
              },
            ]}
          >
            <Clock size={12} color={Colors.$textNeutral} />
            <Text variant="small" style={[localStyles.expiryText, { color: Colors.$textNeutral }]}>
              {timeLeft} left
            </Text>
          </View>
        ) : null}
      </View>
    </>
  )
}

// ── history ─────────────────────────────────────────────────────────────────

function revisionLabel(rev: OfferRevision, index: number, role: OfferRole) {
  const mine = rev.author_role === role
  if (index === 0) return mine ? 'You offered' : 'Buyer offered'
  if (mine) return 'You countered'
  return rev.author_role === 'seller' ? 'Seller countered' : 'Buyer countered'
}

/** Every proposal, oldest first. Only shown once there's been a counter. */
export function OfferHistory({ offer, role }: { offer: Offer; role: OfferRole }) {
  const revisions = offer.offer_revisions ?? []
  if (revisions.length < 2) return null

  return (
    <>
      <Separator orientation="horizontal" style={cardStyles.separator} />
      <View style={localStyles.history}>
        <Text variant="small" style={[localStyles.historyTitle, { color: Colors.$textNeutral }]}>
          Negotiation
        </Text>
        {revisions.map((rev, i) => {
          const latest = i === revisions.length - 1
          return (
            <View key={rev.id} style={localStyles.historyRow}>
              <View
                style={[
                  localStyles.historyDot,
                  {
                    backgroundColor: latest
                      ? Colors.$backgroundPrimaryHeavy
                      : Colors.rgba(Colors.$outlineNeutral, 0.6),
                  },
                ]}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={localStyles.historyHeader}>
                  <Text
                    variant="default"
                    style={[
                      localStyles.historyLabel,
                      { color: latest ? Colors.$textDefault : Colors.$textNeutral },
                    ]}
                  >
                    {revisionLabel(rev, i, role)}
                  </Text>
                  <Text
                    variant="default"
                    style={[
                      localStyles.historyAmount,
                      {
                        color: latest ? Colors.$textDefault : Colors.$textNeutral,
                        textDecorationLine: latest ? 'none' : 'line-through',
                      },
                    ]}
                  >
                    {formatPrice(rev.total_amount)}
                  </Text>
                </View>
                {rev.note ? (
                  <Text
                    variant="small"
                    style={[localStyles.historyNote, { color: Colors.$textNeutral }]}
                  >
                    {`“${rev.note}”`}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </>
  )
}

// ── actions ─────────────────────────────────────────────────────────────────

export function OfferActions({ offer, role }: { offer: Offer; role: OfferRole }) {
  const now = useNow()
  const router = useRouter()
  const { showToast } = useToast()
  const { mutate: updateStatus, isPending: statusPending } = useUpdateOfferStatus()
  const [composerOpen, setComposerOpen] = useState(false)

  const status = effectiveOfferStatus(offer, now)
  const myTurn = isMyTurn(offer, role, now)
  const open = offerResponder(status) !== null

  // Close the composer if the offer moves on underneath it (realtime update, expiry).
  useEffect(() => {
    if (!myTurn) setComposerOpen(false)
  }, [myTurn])

  const walkAway = role === 'seller' ? 'declined' : 'cancelled'

  const run = (next: 'accepted' | 'declined' | 'cancelled') => {
    const copy = {
      accepted: {
        title: status === 'countered' ? 'Counteroffer Accepted' : 'Offer Accepted',
        message: 'The deal is on, and a transaction has been created.',
        failed: 'Failed to accept. Please try again.',
      },
      declined: {
        title: 'Offer Declined',
        message: 'The offer has been declined.',
        failed: 'Failed to decline. Please try again.',
      },
      cancelled: {
        title: 'Offer Cancelled',
        message: 'Your offer has been cancelled.',
        failed: 'Failed to cancel. Please try again.',
      },
    }[next]
    updateStatus(
      { offerId: offer.id, status: next },
      {
        onSuccess: () => showToast({ title: copy.title, message: copy.message }),
        onError: (err) => showToast({ title: 'Error', message: errorMessage(err, copy.failed) }),
      }
    )
  }

  if (status === 'accepted') {
    return (
      <>
        <Separator orientation="horizontal" style={cardStyles.separator} />
        <View style={cardStyles.actions}>
          <Button
            variant="outline"
            size="sm"
            style={cardStyles.actionButton}
            onPress={() => router.push(`/transactions/${offer.id}`)}
          >
            <Text>View Deal</Text>
          </Button>
        </View>
      </>
    )
  }

  if (!open) return null

  // Waiting on the other side: the only move is to walk away.
  if (!myTurn) {
    return (
      <>
        <Separator orientation="horizontal" style={cardStyles.separator} />
        <View style={cardStyles.actions}>
          <Button
            variant="outline"
            size="sm"
            disabled={statusPending}
            onPress={() => run(walkAway)}
            style={cardStyles.actionButton}
          >
            <Text style={[cardStyles.cancelText, { color: Colors.$textDefault }]}>
              {role === 'seller' ? 'Withdraw Counter' : 'Cancel Offer'}
            </Text>
          </Button>
        </View>
      </>
    )
  }

  return (
    <>
      <Separator orientation="horizontal" style={cardStyles.separator} />
      <View style={cardStyles.actions}>
        <Button
          variant="outline"
          size="sm"
          disabled={statusPending}
          onPress={() => run(walkAway)}
          style={cardStyles.actionButton}
        >
          <Text style={[cardStyles.declineText, { color: Colors.$textDefault }]}>Decline</Text>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={statusPending}
          onPress={() => setComposerOpen((v) => !v)}
          style={cardStyles.actionButton}
        >
          <Text style={[cardStyles.declineText, { color: Colors.$textDefault }]}>
            {composerOpen ? 'Close' : 'Counter'}
          </Text>
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={statusPending}
          onPress={() => run('accepted')}
          style={cardStyles.actionButton}
        >
          <Text>Accept</Text>
        </Button>
      </View>
      {composerOpen ? (
        <CounterComposer offer={offer} onDone={() => setComposerOpen(false)} />
      ) : null}
    </>
  )
}

function CounterComposer({ offer, onDone }: { offer: Offer; onDone: () => void }) {
  const { mutate: counter, isPending } = useCounterOffer()
  const { showToast } = useToast()
  const [amount, setAmount] = useState(() => centsToInputString(offer.total_amount))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const cents = inputStringToCents(amount)
    if (cents === null || cents <= 0) {
      setError('Enter a price above zero.')
      return
    }
    if (Math.round(cents) === Math.round(offer.total_amount)) {
      setError('Change the price, or accept the offer as it is.')
      return
    }
    setError(null)
    counter(
      { offerId: offer.id, totalAmount: cents, note },
      {
        onSuccess: () => {
          showToast({
            title: 'Counteroffer Sent',
            message: `You countered with ${formatPrice(cents)}. They have 72 hours to respond.`,
          })
          onDone()
        },
        onError: (err) =>
          setError(errorMessage(err, 'Failed to send counteroffer. Please try again.')),
      }
    )
  }

  const inputBorder = {
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
    backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.6),
  }

  return (
    <View style={localStyles.composer}>
      <View style={[localStyles.amountRow, inputBorder]}>
        <Text style={[localStyles.amountText, { color: Colors.$textNeutral }]}>$</Text>
        <TextInput
          autoFocus
          value={amount}
          onChangeText={(t) => {
            setAmount(t)
            setError(null)
          }}
          onSubmitEditing={submit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          editable={!isPending}
          accessibilityLabel="Counteroffer total"
          style={[localStyles.amountText, localStyles.amountInput, { color: Colors.$textDefault }]}
        />
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add a message (optional)"
        placeholderTextColor={Colors.$textNeutralLight}
        editable={!isPending}
        maxLength={280}
        multiline
        style={[localStyles.noteInput, inputBorder, { color: Colors.$textDefault }]}
      />
      {error ? (
        <Text variant="small" style={{ color: Colors.$textDanger, fontSize: 12 }}>
          {error}
        </Text>
      ) : null}
      <Button variant="primary" size="sm" disabled={isPending} onPress={submit}>
        <Text>{isPending ? 'Sending…' : 'Send Counteroffer'}</Text>
      </Button>
    </View>
  )
}

const localStyles = StyleSheet.create({
  turnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  turnLabel: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  expiryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expiryText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  history: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyLabel: {
    fontSize: 13,
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  historyNote: {
    fontSize: 12,
  },
  composer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  amountText: {
    fontSize: 22,
    fontWeight: '700',
  },
  amountInput: {
    flex: 1,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 40,
  },
})
