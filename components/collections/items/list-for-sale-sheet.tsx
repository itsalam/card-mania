// ITS-134: List for Sale and Manage listing sheets (docs/collections/list-for-sale.md).
//
// Layout: one labelled "$" price field above a single primary action, in a bottom modal.
// References: Shopify's product Price form, a labelled currency field with Save
// (https://mobbin.com/screens/ec76920b-6579-43a3-920b-ad162537a15a), and Glovo's one-field
// bottom sheet with a full-width primary button
// (https://mobbin.com/screens/58eda562-3324-462b-a1d2-0e581521dfc1).
//
// Listing and repricing are one-time commits (CLAUDE.md): the button shows a pending state
// from the tap and the sheet only closes once the server confirms.

import {
  availableQuantity,
  useListForSale,
  useSetAskingPrice,
  useUnlistItem,
} from '@/client/collections/listing'
import { CollectionItem } from '@/client/collections/types'
import { gradePriceKey } from '@/components/tcg-card/GradeBadge'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/input/base-input'
import { Modal } from '@/components/ui/modal'
import { NumberTicker } from '@/components/ui/number-ticker'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text'
import { centsToInputString, formatPrice, inputStringToCents } from '@/components/utils'
import { TCard } from '@/constants/types'
import { getGradingDisplayString } from '@/features/collection/helpers'
import { DollarSign } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { Colors, TouchableOpacity } from 'react-native-ui-lib'

type Entry = Partial<CollectionItem> & { id?: string; quantity?: number }

/** The market price (cents) for an entry's grade, or 0 when there's none. */
export function marketPriceFor(card: TCard | undefined, entry: Entry | undefined) {
  if (!card || !entry) return 0
  const key = gradePriceKey(entry.grading_company, entry.grade_condition?.grade_value)
  const prices = (card.grades_prices ?? {}) as Record<string, number | string | null>
  const cents = Number(prices[key] ?? 0)
  return Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0
}

function entryLabel(entry: Entry) {
  const grade = getGradingDisplayString(entry as CollectionItem)
    .filter((part) => part != null && part !== '·')
    .join(' ')
  return `${grade === 'ungraded' ? 'Raw' : grade} × ${entry.quantity ?? 0}`
}

// Pill picker for which copy group to act on, following the shared toggle convention
// (CLAUDE.md: bordered pill, tinted active segment).
export function EntryPicker({
  entries,
  selected,
  onSelect,
}: {
  entries: Entry[]
  selected: number
  onSelect: (index: number) => void
}) {
  if (entries.length < 2) return null
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignSelf: 'flex-start',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
        padding: 2,
        marginBottom: 12,
      }}
    >
      {entries.map((entry, i) => {
        const active = i === selected
        return (
          <TouchableOpacity
            key={entry.id ?? i}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: active
                ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35)
                : undefined,
            }}
          >
            <Text
              variant="small"
              style={{ color: active ? Colors.$textDefault : Colors.$textNeutral }}
            >
              {entryLabel(entry)}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function PriceField({
  value,
  onChange,
  hint,
}: {
  value: string
  onChange: (text: string) => void
  hint?: string
}) {
  return (
    <View style={{ gap: 4 }}>
      <TextField
        leadingAccessory={<DollarSign size={18} color={Colors.$textDefault} />}
        keyboardType="decimal-pad"
        placeholder="Asking price (USD)"
        floatingPlaceholder
        value={value}
        onChangeText={onChange}
        accessibilityLabel="Asking price in US dollars"
      />
      {hint ? (
        <Text variant="small" style={{ color: Colors.$textNeutral }}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

export function SheetTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 2, paddingBottom: 12 }}>
      <Text variant="h3" style={{ fontSize: 24, lineHeight: 28 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="small" style={{ color: Colors.$textNeutral }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

export function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null
  const message = (error as { message?: string })?.message ?? 'Something went wrong.'
  return (
    <Text variant="small" style={{ color: Colors.$textDanger }}>
      {message}
    </Text>
  )
}

// The sheet's drag gesture (components/ui/modal.tsx) swallows taps on Pressable-based
// buttons, so actions go through ui-lib's TouchableOpacity, as in PriceChangeModal.
export function SheetButton({
  label,
  onPress,
  disabled,
  variant,
  accessibilityHint,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  variant?: 'default' | 'outline'
  accessibilityHint?: string
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View pointerEvents="none">
        <Button size="lg" variant={variant}>
          <Text>{label}</Text>
        </Button>
      </View>
    </TouchableOpacity>
  )
}

/** PC → For Sale: pick the copies, set an asking price (prefilled with the market price). */
export function ListForSaleModal({
  visible,
  onDismiss,
  card,
  entries,
}: {
  visible: boolean
  onDismiss: () => void
  card: TCard
  /** The card's PC rows in the Vault (not mirrors), with copies to list. */
  entries: Entry[]
}) {
  const [selected, setSelected] = useState(0)
  const entry = entries[Math.min(selected, entries.length - 1)]
  const market = marketPriceFor(card, entry)
  const [quantity, setQuantity] = useState(1)
  const [priceDraft, setPriceDraft] = useState('')
  const list = useListForSale()

  // Fresh defaults whenever the sheet opens or the copy group changes.
  useEffect(() => {
    if (!visible) return
    setQuantity(1)
    setPriceDraft(market > 0 ? centsToInputString(market) : '')
    list.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entry?.id])

  const cents = inputStringToCents(priceDraft)
  const valid = Boolean(entry?.id) && cents != null && cents > 0 && quantity >= 1

  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <View style={{ width: '100%', paddingVertical: 16, gap: 12 }}>
        <SheetTitle
          title="List for sale"
          subtitle="Moves these copies from your PC into For Sale, on your storefront and the marketplace."
        />
        <EntryPicker entries={entries} selected={selected} onSelect={setSelected} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text variant="default">Copies</Text>
          <NumberTicker
            min={1}
            max={Math.max(1, entry?.quantity ?? 1)}
            initialNumber={quantity}
            onChangeNumber={setQuantity}
          />
          <Text variant="small" style={{ color: Colors.$textNeutral }}>
            of {entry?.quantity ?? 0}
          </Text>
        </View>
        <PriceField
          value={priceDraft}
          onChange={setPriceDraft}
          hint={
            market > 0
              ? `Market price for this grade: ${formatPrice(market)}`
              : 'No market price for this grade yet.'
          }
        />
        <ErrorLine error={list.error} />
        <Separator orientation="horizontal" />
        <SheetButton
          label={list.isPending ? 'Listing…' : `List ${quantity} for ${formatPrice(cents ?? 0)}`}
          disabled={!valid || list.isPending}
          onPress={() => {
            if (!valid || !entry?.id || cents == null) return
            list.mutate(
              { itemId: entry.id, quantity, askingPriceCents: cents },
              { onSuccess: onDismiss }
            )
          }}
        />
      </View>
    </Modal>
  )
}

/** A listed copy (listing or its Selling / Vault mirror): change the price or take it off sale. */
export function ManageListingModal({
  visible,
  onDismiss,
  card,
  entries,
}: {
  visible: boolean
  onDismiss: () => void
  card: TCard
  entries: (Entry & { asking_price_cents?: number | null; held_quantity?: number | null })[]
}) {
  const [selected, setSelected] = useState(0)
  const entry = entries[Math.min(selected, entries.length - 1)]
  const market = marketPriceFor(card, entry)
  const current = entry?.asking_price_cents ?? null
  const [priceDraft, setPriceDraft] = useState('')
  const setPrice = useSetAskingPrice()
  const unlist = useUnlistItem()

  useEffect(() => {
    if (!visible) return
    const start = current ?? market
    setPriceDraft(start > 0 ? centsToInputString(start) : '')
    setPrice.reset()
    unlist.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entry?.id])

  const cents = inputStringToCents(priceDraft)
  const priceValid = cents != null && cents > 0 && cents !== current
  const busy = setPrice.isPending || unlist.isPending
  const onHold = (entry?.held_quantity ?? 0) > 0
  const subtitle = useMemo(() => {
    if (current) return `Asking ${formatPrice(current)} per copy`
    return market > 0
      ? `No asking price yet: buyers see the market price (${formatPrice(market)})`
      : 'No asking price yet'
  }, [current, market])

  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <View style={{ width: '100%', paddingVertical: 16, gap: 12 }}>
        <SheetTitle title="Listing" subtitle={subtitle} />
        <EntryPicker entries={entries} selected={selected} onSelect={setSelected} />
        <PriceField
          value={priceDraft}
          onChange={setPriceDraft}
          hint={market > 0 ? `Market price for this grade: ${formatPrice(market)}` : undefined}
        />
        <ErrorLine error={setPrice.error ?? unlist.error} />
        <SheetButton
          label={setPrice.isPending ? 'Saving…' : 'Save price'}
          disabled={!priceValid || busy || !entry?.id}
          onPress={() => {
            if (!entry?.id || cents == null) return
            setPrice.mutate({ itemId: entry.id, askingPriceCents: cents }, { onSuccess: onDismiss })
          }}
        />
        <Separator orientation="horizontal" />
        <SheetButton
          variant="outline"
          label={
            unlist.isPending
              ? 'Removing…'
              : onHold
                ? 'On hold for a sale in progress'
                : `Remove from sale (${availableQuantity(entry ?? {})} back to PC)`
          }
          disabled={busy || onHold || !entry?.id}
          onPress={() => {
            if (!entry?.id) return
            unlist.mutate(entry.id, { onSuccess: onDismiss })
          }}
          accessibilityHint="Moves these copies back into your PC"
        />
      </View>
    </Modal>
  )
}
