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
      await updateProfile({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        is_hobbyiest: isHobbyist,
        is_seller: isTrader,
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
