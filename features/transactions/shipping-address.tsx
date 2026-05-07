import { useConfirmShippingAddress } from '@/client/transactions'
import { ShippingAddress } from '@/client/transactions/types'
import { useToast } from '@/components/Toast'
import { useSectionWarning } from '@/components/ui/collapsible-section'
import { TextField } from '@/components/ui/input/base-input'
import { Text } from '@/components/ui/text/base-text'
import { useUserStore } from '@/lib/store/useUserStore'
import { CheckCircle, MapPin, Square, SquareCheck } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

function parseAddress(raw: unknown): ShippingAddress | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.street !== 'string' || typeof r.city !== 'string') return null
  return {
    street: r.street,
    apt: typeof r.apt === 'string' ? r.apt : undefined,
    city: r.city,
    state: typeof r.state === 'string' ? r.state : '',
    postal_code: typeof r.postal_code === 'string' ? r.postal_code : '',
    country: typeof r.country === 'string' ? r.country : '',
  }
}

function AddressFields({
  value: addr,
  onChange,
}: {
  value: ShippingAddress
  onChange: (a: ShippingAddress) => void
}) {
  const set = (key: keyof ShippingAddress, val: string) => onChange({ ...addr, [key]: val })

  return (
    <View style={fieldStyles.container}>
      <TextField
        placeholder="Street address"
        value={addr.street}
        onChangeText={(v) => set('street', v)}
        autoCapitalize="words"
        floatingPlaceholder
      />
      <TextField
        placeholder="Apt / Suite (optional)"
        value={addr.apt ?? ''}
        onChangeText={(v) => set('apt', v)}
        autoCapitalize="words"
        floatingPlaceholder
      />
      <View style={fieldStyles.row}>
        <View style={fieldStyles.flex2}>
          <TextField
            placeholder="City"
            value={addr.city}
            onChangeText={(v) => set('city', v)}
            autoCapitalize="words"
            floatingPlaceholder
          />
        </View>
        <View style={fieldStyles.flex1}>
          <TextField
            placeholder="State"
            value={addr.state}
            onChangeText={(v) => set('state', v)}
            autoCapitalize="characters"
            autoCorrect={false}
            floatingPlaceholder
          />
        </View>
      </View>
      <View style={fieldStyles.row}>
        <View style={fieldStyles.flex1}>
          <TextField
            placeholder="ZIP / Postal"
            value={addr.postal_code}
            onChangeText={(v) => set('postal_code', v)}
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            floatingPlaceholder
          />
        </View>
        <View style={fieldStyles.flex2}>
          <TextField
            placeholder="Country"
            value={addr.country}
            onChangeText={(v) => set('country', v)}
            autoCapitalize="words"
            floatingPlaceholder
          />
        </View>
      </View>
    </View>
  )
}

const fieldStyles = StyleSheet.create({
  container: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
})

function ConfirmedAddressBadge({ address }: { address: ShippingAddress }) {
  const lines = [
    [address.street, address.apt].filter(Boolean).join(' '),
    `${address.city}, ${address.state} ${address.postal_code}`.trim(),
    address.country,
  ].filter(Boolean)

  return (
    <View style={badgeStyles.container}>
      <View style={badgeStyles.row}>
        <CheckCircle size={16} color={Colors.$backgroundSuccessHeavy} />
        <Text variant="small" style={badgeStyles.confirmed}>
          Address confirmed
        </Text>
      </View>
      {lines.map((l, i) => (
        <Text key={i} variant="default" style={badgeStyles.line}>
          {l}
        </Text>
      ))}
    </View>
  )
}

const badgeStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmed: { color: Colors.$backgroundSuccessHeavy, fontWeight: '600' },
  line: { color: Colors.$textNeutral },
})

// ── Main section ──────────────────────────────────────────────────────────────

export function ShippingAddressSection({
  offerId,
  isBuyer,
  confirmedAddress,
}: {
  offerId: string
  isBuyer: boolean
  confirmedAddress: unknown
}) {
  const profile = useUserStore((s) => s.profile)
  const { showToast } = useToast()
  const { mutate: confirmAddress, isPending } = useConfirmShippingAddress()
  const { setWarning } = useSectionWarning()

  const saved = parseAddress(confirmedAddress)
  const profileSaved = parseAddress(profile?.shipping_address)

  const empty: ShippingAddress = { street: '', city: '', state: '', postal_code: '', country: '' }
  const [editing, setEditing] = useState(!saved)
  const [draft, setDraft] = useState<ShippingAddress>(saved ?? profileSaved ?? empty)
  const usingProfile =
    profileSaved !== null &&
    draft.street === profileSaved.street &&
    draft.city === profileSaved.city &&
    draft.postal_code === profileSaved.postal_code

  const toggleProfileAddress = () => {
    if (usingProfile) {
      setDraft(empty)
    } else if (profileSaved) {
      setDraft(profileSaved)
    }
  }

  const isValid =
    draft.street.trim().length > 0 &&
    draft.city.trim().length > 0 &&
    draft.postal_code.trim().length > 0

  useEffect(() => {
    if (!saved) {
      setWarning({ type: 'warning', message: isBuyer ? 'Required' : 'Pending' })
    } else {
      setWarning(null)
    }
  }, [isBuyer, saved, setWarning])

  const handleConfirm = () => {
    if (!isValid) return
    confirmAddress(
      { offerId, address: draft },
      {
        onSuccess: () => {
          setEditing(false)
          showToast({ title: 'Address confirmed', message: '' })
        },
        onError: () => showToast({ title: 'Error', message: 'Could not save address.' }),
      }
    )
  }

  // Sellers only see what the buyer confirmed
  if (!isBuyer) {
    return (
      <View style={sectionStyles.container}>
        {saved ? (
          <ConfirmedAddressBadge address={saved} />
        ) : (
          <View style={sectionStyles.pending}>
            <MapPin size={16} color={Colors.$iconNeutralLight} />
            <Text variant="muted" style={sectionStyles.pendingText}>
              {"Awaiting buyer\'s shipping address"}
            </Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={sectionStyles.container}>
      {!editing && saved ? (
        <>
          <ConfirmedAddressBadge address={saved} />
          <TouchableOpacity onPress={() => setEditing(true)} style={sectionStyles.editLink}>
            <Text variant="small" style={sectionStyles.editLinkText}>
              Edit address
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {profileSaved && (
            <TouchableOpacity onPress={toggleProfileAddress} style={sectionStyles.tickRow}>
              {usingProfile ? (
                <SquareCheck size={18} color={Colors.$backgroundPrimaryHeavy} />
              ) : (
                <Square size={18} color={Colors.$iconNeutralLight} />
              )}
              <Text variant="default" style={sectionStyles.tickLabel}>
                Use my saved address
              </Text>
            </TouchableOpacity>
          )}
          <AddressFields value={draft} onChange={setDraft} />
          <View style={sectionStyles.buttonRow}>
            {saved && (
              <TouchableOpacity onPress={() => setEditing(false)} style={sectionStyles.cancelBtn}>
                <Text variant="default" style={{ color: Colors.$textNeutral }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!isValid || isPending}
              style={[
                sectionStyles.confirmBtn,
                (!isValid || isPending) && sectionStyles.btnDisabled,
              ]}
            >
              <Text variant="default" style={sectionStyles.confirmBtnText}>
                {isPending ? 'Saving…' : 'Confirm Address'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  container: { paddingTop: 8, paddingBottom: 4 },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pendingText: { color: Colors.$textNeutralLight },
  editLink: { paddingHorizontal: 16, paddingBottom: 10 },
  editLinkText: { color: Colors.$textPrimary, fontWeight: '500' },
  tickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  tickLabel: { color: Colors.$textNeutral },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.$outlineDefault,
  },
  confirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.$backgroundPrimaryHeavy,
  },
  btnDisabled: { opacity: 0.45 },
  confirmBtnText: { color: '#fff', fontWeight: '600' },
})
