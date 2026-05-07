import { ShippingAddress } from '@/client/transactions/types'
import { TextField } from '@/components/ui/input/base-input'
import { Text } from '@/components/ui/text/base-text'
import LocationPicker from '@/features/settings/components/location-picker'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import { ChevronLeft, MapPin, Star, TrendingUp } from 'lucide-react-native'
import { useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
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

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="small"
      style={{ fontSize: 13, color: Colors.$textNeutralLight, marginTop: 8, marginBottom: 2 }}
    >
      {children.toUpperCase()}
    </Text>
  )
}

type CompactChipProps = {
  label: string
  icon: React.ReactNode
  active: boolean
  onPress: () => void
}

function CompactChip({ label, icon, active, onPress }: CompactChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: active ? Colors.$backgroundPrimaryHeavy : Colors.$outlineDefault,
        backgroundColor: active
          ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.12)
          : Colors.$backgroundElevated,
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
    >
      {icon}
      <Text variant="large" style={{ fontWeight: '600', fontSize: 16 }}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export function EditProfilePage() {
  const { profile, updateProfile } = useUserStore()
  const router = useRouter()

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(profile?.username?.replace(/^@/, '') ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [isHobbyist, setIsHobbyist] = useState(profile?.is_hobbyiest ?? false)
  const [isTrader, setIsTrader] = useState(profile?.is_seller ?? false)
  const empty: ShippingAddress = { street: '', city: '', state: '', postal_code: '', country: '' }
  const [address, setAddress] = useState<ShippingAddress>(
    parseAddress(profile?.shipping_address) ?? empty
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    if (!displayName.trim()) return setError('Display name is required.')
    if (!username.trim()) return setError('Handle is required.')
    if (!/^[a-z0-9_]+$/.test(username.trim()))
      return setError('Handle may only contain lowercase letters, numbers, and underscores.')
    setSaving(true)
    try {
      const addrToSave = address.street.trim() ? (address as any) : null
      await updateProfile({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        is_hobbyiest: isHobbyist,
        is_seller: isTrader,
        shipping_address: addrToSave,
      })
      router.back()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const iconColor = (active: boolean) =>
    active ? Colors.$backgroundPrimaryHeavy : Colors.$iconNeutral

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.$backgroundDefault }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderColor: Colors.$outlineDefault,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <ChevronLeft size={24} color={Colors.$iconDefault} />
        </TouchableOpacity>
        <Text
          variant="h3"
          style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600' }}
        >
          Edit Profile
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={{ padding: 4 }}>
          <Text
            style={{
              color: saving ? Colors.$textDisabled : Colors.$textPrimary,
              fontWeight: '600',
              fontSize: 16,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity */}
        <SectionLabel>Identity</SectionLabel>
        <TextField
          placeholder="Display name"
          value={displayName}
          onChangeText={(v) => {
            setError(null)
            setDisplayName(v)
          }}
          autoCapitalize="words"
          floatingPlaceholder
        />
        <TextField
          placeholder="@handle"
          value={username ? `@${username}` : ''}
          onChangeText={(v) => {
            setError(null)
            setUsername(v.replace(/^@+/, '').toLowerCase())
          }}
          autoCapitalize="none"
          autoCorrect={false}
          floatingPlaceholder
        />

        {/* Bio */}
        <SectionLabel>Bio</SectionLabel>
        <TextField
          placeholder="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          floatingPlaceholder
          containerStyle={{ minHeight: 100 }}
        />

        {/* Collector type */}
        <SectionLabel>How you collect</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <CompactChip
            label="Hobbyist"
            icon={<Star size={18} color={iconColor(isHobbyist)} />}
            active={isHobbyist}
            onPress={() => setIsHobbyist((v) => !v)}
          />
          <CompactChip
            label="Trader"
            icon={<TrendingUp size={18} color={iconColor(isTrader)} />}
            active={isTrader}
            onPress={() => setIsTrader((v) => !v)}
          />
        </View>

        {/* Location */}
        <SectionLabel>Location</SectionLabel>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 2,
            borderColor: Colors.$outlineDefault,
            backgroundColor: Colors.$backgroundElevated,
            paddingHorizontal: 4,
          }}
        >
          <LocationPicker>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
              <MapPin size={20} color={Colors.$iconDefault} />
              <Text variant="large" style={{ fontSize: 16, color: Colors.$textNeutralLight }}>
                Location
              </Text>
            </View>
          </LocationPicker>
        </View>

        {/* Shipping address */}
        <SectionLabel>Shipping Address</SectionLabel>
        <Text variant="small" style={{ color: Colors.$textNeutralLight, marginBottom: 4 }}>
          Used to pre-fill your address when confirming trades.
        </Text>
        <TextField
          placeholder="Street address"
          value={address.street}
          onChangeText={(v) => setAddress((a) => ({ ...a, street: v }))}
          autoCapitalize="words"
          floatingPlaceholder
        />
        <TextField
          placeholder="Apt / Suite (optional)"
          value={address.apt ?? ''}
          onChangeText={(v) => setAddress((a) => ({ ...a, apt: v }))}
          autoCapitalize="words"
          floatingPlaceholder
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 2 }}>
            <TextField
              placeholder="City"
              value={address.city}
              onChangeText={(v) => setAddress((a) => ({ ...a, city: v }))}
              autoCapitalize="words"
              floatingPlaceholder
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              placeholder="State"
              value={address.state}
              onChangeText={(v) => setAddress((a) => ({ ...a, state: v }))}
              autoCapitalize="characters"
              autoCorrect={false}
              floatingPlaceholder
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TextField
              placeholder="ZIP / Postal"
              value={address.postal_code}
              onChangeText={(v) => setAddress((a) => ({ ...a, postal_code: v }))}
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              floatingPlaceholder
            />
          </View>
          <View style={{ flex: 2 }}>
            <TextField
              placeholder="Country"
              value={address.country}
              onChangeText={(v) => setAddress((a) => ({ ...a, country: v }))}
              autoCapitalize="words"
              floatingPlaceholder
            />
          </View>
        </View>

        {error ? (
          <Text style={{ color: Colors.$textDanger, fontSize: 14, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
