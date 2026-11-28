// ITS-137: Item details sheet: cost basis, serial number and condition notes, with the copies'
// market value and unrealized gain (docs/collections/item-attributes.md).
//
// Layout: a contained summary of label / value rows (Market value, Cost, Unrealized gain with
// its percentage in green or red) above the fields, then one Save button.
// References: Fidelity's position details (Total value, Average cost, Total gain/loss as label /
// value rows, gain in green with its percentage)
// (https://mobbin.com/screens/8b6bc6fa-11c6-400b-978e-3e895e3ef061), Lightyear's profit and
// loss sheet (https://mobbin.com/screens/3bbd7fe8-2e93-4540-a045-2c6b4e642bfd), and Public's
// contained cost basis summary (https://mobbin.com/screens/b8208254-9065-4d64-9783-da4d95becd17).
//
// Saving is a form commit (CLAUDE.md): the button shows "Saving…" from the tap and the sheet
// closes once the server confirms.

import {
  formatGain,
  formatGainPercent,
  gainRatio,
  normalizeSerial,
  unrealizedGain,
  useItemDetails,
  useSetItemDetails,
} from '@/client/collections/item-details'
import { CollectionItem } from '@/client/collections/types'
import { TextField } from '@/components/ui/input/base-input'
import { Modal } from '@/components/ui/modal'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text'
import { centsToInputString, formatPrice, inputStringToCents } from '@/components/utils'
import { TCard } from '@/constants/types'
import { DollarSign, Hash, NotebookPen } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import {
  EntryPicker,
  ErrorLine,
  marketPriceFor,
  SheetButton,
  SheetTitle,
} from './list-for-sale-sheet'

type Entry = Partial<CollectionItem> & { id?: string; quantity?: number }

const NOTES_MAX = 1000
// Whole dollars with up to 2 decimals. Stricter than inputStringToCents, whose parseFloat
// would read "12abc" as 12.
const COST_PATTERN = /^\d{1,7}(\.\d{0,2})?$/

// formatPrice shows 0 as "--.--"; a free card's cost is a real $0.00.
const money = (cents: number) => (cents === 0 ? '$0.00' : formatPrice(cents))

function SummaryRow({
  label,
  value,
  detail,
  color,
}: {
  label: string
  value: string
  detail?: string
  color?: string
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text variant="small" style={{ color: Colors.$textNeutral }}>
        {label}
      </Text>
      <Text variant="small" style={{ color: color ?? Colors.$textDefault, fontWeight: '600' }}>
        {value}
        {detail ? (
          <Text variant="small" style={{ color: Colors.$textNeutralLight, fontWeight: '400' }}>
            {`  ${detail}`}
          </Text>
        ) : null}
      </Text>
    </View>
  )
}

function FieldHint({ children }: { children: string }) {
  return (
    <Text variant="small" style={{ color: Colors.$textNeutral }}>
      {children}
    </Text>
  )
}

export function ItemDetailsModal({
  visible,
  onDismiss,
  card,
  entries,
}: {
  visible: boolean
  onDismiss: () => void
  card: TCard
  /** The card's rows in this collection (mirrors included: they edit their listing). */
  entries: Entry[]
}) {
  const [selected, setSelected] = useState(0)
  const entry = entries[Math.min(selected, entries.length - 1)]
  const { data: details, isLoading } = useItemDetails(entry?.id, visible)
  const save = useSetItemDetails()

  const [costDraft, setCostDraft] = useState('')
  const [serialDraft, setSerialDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')

  // Fresh drafts whenever the sheet opens, the row changes or its saved details arrive.
  useEffect(() => {
    if (!visible) return
    setCostDraft(details?.costBasisCents != null ? centsToInputString(details.costBasisCents) : '')
    setSerialDraft(details?.serialNumber ?? '')
    setNotesDraft(details?.conditionNotes ?? '')
    save.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entry?.id, details])

  const quantity = details?.quantity ?? entry?.quantity ?? 0
  const market = details?.marketValueCents ?? marketPriceFor(card, entry)
  const costText = costDraft.trim()
  const cost = costText === '' || !COST_PATTERN.test(costText) ? null : inputStringToCents(costText)
  const costInvalid = costText !== '' && cost == null
  const serial = normalizeSerial(serialDraft)
  const serialAllowed = quantity <= 1
  const notes = notesDraft.trim() || null

  const gain = unrealizedGain({ marketValueCents: market, costBasisCents: cost, quantity })
  const ratio = gainRatio(gain, cost == null ? null : cost * quantity)
  const gainColor =
    gain == null || gain === 0 ? undefined : gain > 0 ? Colors.$textSuccess : Colors.$textDanger

  const changed =
    cost !== (details?.costBasisCents ?? null) ||
    serial !== (details?.serialNumber ?? null) ||
    notes !== (details?.conditionNotes ?? null)
  const valid = !costInvalid && (serialAllowed || serial == null)

  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <View style={{ width: '100%', paddingVertical: 16, gap: 12 }}>
        <SheetTitle
          title="Item details"
          subtitle={`${quantity} ${quantity === 1 ? 'copy' : 'copies'} · cost and notes are only visible to you`}
        />
        <EntryPicker entries={entries} selected={selected} onSelect={setSelected} />

        {/* Contained summary: what the copies are worth against what they cost. */}
        <View
          style={{
            padding: 12,
            gap: 8,
            borderRadius: 12,
            backgroundColor: Colors.rgba(Colors.$backgroundNeutral, 0.5),
            borderWidth: 1,
            borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
          }}
        >
          <SummaryRow
            label="Market value"
            value={market > 0 ? formatPrice(market * quantity) : 'No price'}
            detail={market > 0 && quantity > 1 ? `${formatPrice(market)} each` : undefined}
          />
          <SummaryRow
            label="Cost"
            value={cost == null ? 'Not set' : money(cost * quantity)}
            detail={cost != null && quantity > 1 ? `${money(cost)} each` : undefined}
            color={cost == null ? Colors.$textNeutralLight : undefined}
          />
          <View style={{ height: 1, backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.4) }} />
          <SummaryRow
            label="Unrealized gain"
            value={gain == null ? '—' : formatGain(gain)}
            detail={ratio == null ? undefined : formatGainPercent(ratio)}
            color={gainColor}
          />
        </View>

        <View style={{ gap: 4 }}>
          <TextField
            leadingAccessory={<DollarSign size={18} color={Colors.$textDefault} />}
            keyboardType="decimal-pad"
            placeholder="Cost per copy (USD)"
            floatingPlaceholder
            value={costDraft}
            onChangeText={setCostDraft}
            editable={!isLoading}
            accessibilityLabel="Cost per copy in US dollars"
          />
          <FieldHint>
            {costInvalid ? 'Enter an amount like 12.50.' : 'What you paid for one copy.'}
          </FieldHint>
        </View>

        <View style={{ gap: 4 }}>
          <TextField
            leadingAccessory={<Hash size={18} color={Colors.$textDefault} />}
            placeholder="Serial number"
            floatingPlaceholder
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={32}
            value={serialDraft}
            onChangeText={setSerialDraft}
            editable={!isLoading && (serialAllowed || serialDraft !== '')}
            accessibilityLabel="Serial number"
          />
          <FieldHint>
            {serialAllowed
              ? 'For numbered cards, e.g. 12/99. Shown with the card.'
              : `A serial number belongs to one copy; this row holds ${quantity}.`}
          </FieldHint>
        </View>

        <View style={{ gap: 4 }}>
          <TextField
            leadingAccessory={<NotebookPen size={18} color={Colors.$textDefault} />}
            placeholder="Condition notes"
            floatingPlaceholder
            multiline
            numberOfLines={3}
            maxLength={NOTES_MAX}
            containerStyle={{ minHeight: 88 }}
            value={notesDraft}
            onChangeText={setNotesDraft}
            editable={!isLoading}
            accessibilityLabel="Condition notes"
          />
          <FieldHint>{`Centering, corners, surface… ${notesDraft.length}/${NOTES_MAX}`}</FieldHint>
        </View>

        <ErrorLine error={save.error} />
        <Separator orientation="horizontal" />
        <SheetButton
          label={save.isPending ? 'Saving…' : 'Save'}
          disabled={!entry?.id || !changed || !valid || save.isPending || isLoading}
          onPress={() => {
            if (!entry?.id || !valid) return
            save.mutate(
              {
                itemId: entry.id,
                costBasisCents: cost,
                serialNumber: serial,
                conditionNotes: notes,
              },
              { onSuccess: onDismiss }
            )
          }}
        />
      </View>
    </Modal>
  )
}
