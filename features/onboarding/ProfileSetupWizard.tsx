import { GradientBackground } from '@/components/Background'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/input/base-input'
import { Text } from '@/components/ui/text/base-text'
import { useOnboardingStore } from '@/features/onboarding/OnboardingProvider'
import LocationPicker from '@/features/settings/components/location-picker'
import { useUserStore } from '@/lib/store/useUserStore'
import { MapPin, Star, TrendingUp } from 'lucide-react-native'
import { MotiTransitionProp, MotiView } from 'moti'
import { useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

const TOTAL_STEPS = 4
const isDev = process.env.NODE_ENV !== 'production'
const PAGE_TRANSITION: MotiTransitionProp = {
  translateX: {
    type: 'spring',
    mass: 0.5,
    damping: 40,
    stiffness: 180,
    overshootClamping: true,
  },
}

// ── Step dots ─────────────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor:
              i === current
                ? (Colors.$backgroundPrimaryHeavy ?? '#fff')
                : Colors.rgba(Colors.$backgroundElevated ?? '#fff', 0.4),
          }}
        />
      ))}
    </View>
  )
}

// ── Collector type chip ───────────────────────────────────────────────────────

type CollectorChipProps = {
  label: string
  description: string
  icon: React.ReactNode
  active: boolean
  onPress: () => void
}

function CollectorChip({ label, description, icon, active, onPress }: CollectorChipProps) {
  const borderColor = active
    ? (Colors.$backgroundPrimaryHeavy ?? '#fff')
    : Colors.rgba(Colors.$backgroundElevated ?? '#fff', 0.3)
  const bgColor = active
    ? Colors.rgba(Colors.$backgroundPrimaryHeavy ?? '#fff', 0.15)
    : Colors.rgba(Colors.$backgroundElevated ?? '#fff', 0.05)
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'column',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 2,
        borderColor,
        backgroundColor: bgColor,
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text className="text-white text-base font-semibold">{label}</Text>
      </View>
      <Text
        style={{ color: Colors.rgba('#fff', active ? 0.85 : 0.5), fontSize: 13, lineHeight: 18 }}
      >
        {description}
      </Text>
    </TouchableOpacity>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export function ProfileSetupWizard() {
  const { profile, updateProfile, setProfileSetupComplete } = useUserStore()

  const [step, setStep] = useState(0)
  const direction = useRef<1 | -1>(1)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(
    profile?.username ? profile.username.replace(/^@/, '') : ''
  )
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [isHobbyist, setIsHobbyist] = useState(profile?.is_hobbyiest ?? false)
  const [isTrader, setIsTrader] = useState(profile?.is_seller ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startTour = () => setTimeout(() => useOnboardingStore.getState().start(), 900)

  const handleSkipAll = async () => {
    await setProfileSetupComplete(true)
    startTour()
  }

  const handleNext = () => {
    if (step === 0) {
      if (!displayName.trim()) return setError('Please enter a display name.')
      if (!username.trim()) return setError('Please enter a handle.')
      if (!/^[a-z0-9_]+$/.test(username.trim()))
        return setError('Handle can only contain lowercase letters, numbers, and underscores.')
    }
    setError(null)
    direction.current = 1
    setStep((s) => s + 1)
  }

  const handleBack = () => {
    setError(null)
    direction.current = -1
    setStep((s) => s - 1)
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      await updateProfile({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        is_hobbyiest: isHobbyist,
        is_seller: isTrader,
      })
      await setProfileSetupComplete(true)
      startTour()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save profile. Please try again.')
      setSaving(false)
    }
  }

  const fieldStyle = { backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4) }

  return (
    <GradientBackground>
      <MotiView
        key={step}
        from={{ opacity: 0, translateX: direction.current * 30 }}
        animate={{ opacity: 1, translateX: 0 }}
        exit={{ opacity: 0, translateX: direction.current * -30 }}
        transition={PAGE_TRANSITION}
        style={{
          flex: 1,
          width: '100%',
          paddingHorizontal: 32,
          gap: 20,
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'center',
        }}
      >
        {isDev && (
          <TouchableOpacity
            onPress={handleSkipAll}
            style={{ alignSelf: 'flex-end' }}
            accessibilityLabel="Skip profile setup (dev only)"
          >
            <Text className="text-white opacity-50 text-xs">Skip setup</Text>
          </TouchableOpacity>
        )}
        {/* ── Step 1: Identity ── */}
        {step === 0 && (
          <>
            <Text className="text-white text-2xl font-bold">Your identity</Text>
            <Text className="text-white opacity-70 leading-6">
              How should others know you on CardMania?
            </Text>

            <TextField
              placeholder="Display name"
              value={displayName}
              onChangeText={(v) => {
                setError(null)
                setDisplayName(v)
              }}
              autoCapitalize="words"
              floatingPlaceholder
              containerStyle={fieldStyle}
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
              containerStyle={fieldStyle}
            />
          </>
        )}

        {/* ── Step 2: Bio ── */}
        {step === 1 && (
          <>
            <Text className="text-white text-2xl font-bold">About you</Text>
            <Text className="text-white opacity-70 leading-6">
              A short intro shown on your profile. Totally optional.
            </Text>

            <TextField
              placeholder="Bio"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              floatingPlaceholder
              containerStyle={[fieldStyle, { minHeight: 100 }]}
            />
          </>
        )}

        {/* ── Step 3: Collector type ── */}
        {step === 2 && (
          <>
            <Text className="text-white text-2xl font-bold">How you collect</Text>
            <Text className="text-white opacity-70 leading-6">
              Select all that apply — you can change this any time.
            </Text>

            <View style={{ flexDirection: 'column', gap: 12 }}>
              <CollectorChip
                label="Hobbyist"
                description="You're building specific sets or collections. Nearby sellers and traders can find you when they have cards you're looking for. You have more control over how public your profile and location are."
                icon={<Star size={20} color={isHobbyist ? '#fff' : Colors.rgba('#fff', 0.5)} />}
                active={isHobbyist}
                onPress={() => setIsHobbyist((v) => !v)}
              />
              <CollectorChip
                label="Trader"
                description="You buy and sell actively for margins. Your storefront is discoverable at greater distances and your profile is more publicly visible, making it easier for hobbyists and other traders to find you."
                icon={<TrendingUp size={20} color={isTrader ? '#fff' : Colors.rgba('#fff', 0.5)} />}
                active={isTrader}
                onPress={() => setIsTrader((v) => !v)}
              />
            </View>
          </>
        )}

        {/* ── Step 4: Location ── */}
        {step === 3 && (
          <>
            <Text className="text-white text-2xl font-bold">Your location</Text>
            <Text className="text-white opacity-70 leading-6">
              Connects you with nearby collectors and sellers. Hobbyists get more privacy control;
              traders get broader reach. You can change this any time.
            </Text>

            <View
              style={{
                borderRadius: 14,
                borderWidth: 2,
                borderColor: Colors.rgba('#fff', 0.3),
                backgroundColor: Colors.rgba('#fff', 0.05),
                paddingHorizontal: 8,
              }}
            >
              <LocationPicker>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 }}
                >
                  <MapPin size={20} color={Colors.rgba('#fff', 0.7)} />
                  <Text className="text-white opacity-70">Location</Text>
                </View>
              </LocationPicker>
            </View>
          </>
        )}

        {/* Error */}
        {error ? <Text className="text-red-400 text-sm text-center">{error}</Text> : null}

        {/* Navigation */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <StepDots current={step} />

          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {/* Skip link for optional steps */}
            {step > 0 && (
              <TouchableOpacity
                onPress={step === TOTAL_STEPS - 1 ? handleFinish : handleNext}
                accessibilityLabel="Skip this step"
              >
                <Text className="text-white opacity-50 text-sm">Skip</Text>
              </TouchableOpacity>
            )}

            {step > 0 && (
              <Button variant="outline" onPress={handleBack} disabled={saving}>
                <Text className="text-white">Back</Text>
              </Button>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <Button onPress={handleNext}>
                <Text className="text-white">Next</Text>
              </Button>
            ) : (
              <Button onPress={handleFinish} disabled={saving}>
                <Text className="text-white">{saving ? 'Saving…' : 'Finish'}</Text>
              </Button>
            )}
          </View>
        </View>
      </MotiView>
    </GradientBackground>
  )
}
