import { ShippingAddress } from '@/client/transactions/types'
import { Spinner } from '@/components/ui/spinner'
import { TextField } from '@/components/ui/input/base-input'
import { Text } from '@/components/ui/text/base-text'
import { useOnboardingStore } from '@/features/onboarding/OnboardingProvider'
import { PasswordStrengthGauge } from '@/features/splash/PasswordStrengthGauge'
import { DEFAULT_POLICY, policyError } from '@/features/splash/usePasswordPolicy'
import LocationPicker from '@/features/settings/components/location-picker'
import { useUserStore } from '@/lib/store/useUserStore'
import { Eye, EyeOff, Lock, MapPin, Star, TrendingUp } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { Pressable, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

const TOTAL_STEPS = 6

// ── Step dots ─────────────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={
            {
              width: i === current ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                i === current
                  ? Colors.$backgroundPrimaryHeavy
                  : Colors.rgba(Colors.$outlineNeutral, 0.4),
              transition: 'width 0.2s ease, background-color 0.2s ease',
            } as any
          }
        />
      ))}
    </View>
  )
}

// ── Collector chip ─────────────────────────────────────────────────────────────

function CollectorChip({
  label,
  description,
  icon,
  active,
  onPress,
}: {
  label: string
  description: string
  icon: React.ReactNode
  active: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={
        {
          gap: 8,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: active
            ? Colors.$backgroundPrimaryHeavy
            : Colors.rgba(Colors.$outlineNeutral, 0.35),
          backgroundColor: active
            ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.1)
            : Colors.rgba(Colors.$backgroundElevated, 0.4),
          transition: 'border-color 0.15s, background-color 0.15s',
        } as any
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.$textDefault }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 13, lineHeight: 18, color: Colors.$textNeutral }}>
        {description}
      </Text>
    </TouchableOpacity>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export function ProfileSetupWizard() {
  const { profile, updateProfile, setProfileSetupComplete, setPassword, user } = useUserStore()
  const isPhoneUser = user?.app_metadata?.provider === 'phone'

  const startStep = isPhoneUser ? 0 : 1
  const [step, setStep] = useState(startStep)
  const [fading, setFading] = useState(false)
  const direction = useRef<1 | -1>(1)

  // Step 0
  const [password, setPasswordValue] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  // Steps 1–5
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(
    profile?.username ? profile.username.replace(/^@/, '') : ''
  )
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [isHobbyist, setIsHobbyist] = useState(profile?.is_hobbyiest ?? false)
  const [isTrader, setIsTrader] = useState(profile?.is_seller ?? false)
  const [address, setAddress] = useState<ShippingAddress>({
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startTour = () => setTimeout(() => useOnboardingStore.getState().start(), 900)

  const navigateTo = (next: number) => {
    setFading(true)
    setTimeout(() => {
      setStep(next)
      setFading(false)
    }, 180)
  }

  const handleNext = async () => {
    if (step === 0) {
      const pwErr = policyError(password, DEFAULT_POLICY)
      if (pwErr) return setError(pwErr)
      if (password !== confirmPassword) return setError('Passwords do not match.')
      setSaving(true)
      try {
        await setPassword(password)
      } catch (err: any) {
        setError(err?.message ?? 'Failed to set password.')
        setSaving(false)
        return
      }
      setSaving(false)
    }
    if (step === 1) {
      if (!displayName.trim()) return setError('Please enter a display name.')
      if (!username.trim()) return setError('Please enter a handle.')
      if (!/^[a-z0-9_]+$/.test(username.trim()))
        return setError('Handle may only contain lowercase letters, numbers, and underscores.')
    }
    setError(null)
    direction.current = 1
    navigateTo(step + 1)
  }

  const handleBack = () => {
    setError(null)
    direction.current = -1
    navigateTo(Math.max(step - 1, startStep))
  }

  const handleFinish = async () => {
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
      await setProfileSetupComplete(true)
      startTour()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save profile.')
      setSaving(false)
    }
  }

  const handleSkip = () => {
    if (step === TOTAL_STEPS - 1) {
      handleFinish()
    } else {
      setError(null)
      navigateTo(step + 1)
    }
  }

  const fieldStyle = {
    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.5),
  }

  return (
    // Full-screen backdrop
    <View
      style={
        {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.65)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        } as any
      }
    >
      {/* Card */}
      <View
        style={
          {
            width: '100%',
            maxWidth: 520,
            backgroundColor: Colors.$backgroundDefault,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: Colors.rgba(Colors.$outlineNeutral, 0.2),
            padding: 32,
            gap: 20,
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          } as any
        }
      >
        {/* Step content — fades between steps */}
        <View
          style={
            {
              gap: 16,
              opacity: fading ? 0 : 1,
              transform: [{ translateX: fading ? direction.current * 16 : 0 }],
              transition: 'opacity 0.18s ease, transform 0.18s ease',
            } as any
          }
        >
          {/* ── Step 0: Password ── */}
          {step === 0 && (
            <>
              <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.$textDefault }}>
                Secure your account
              </Text>
              <Text style={{ color: Colors.$textNeutral, lineHeight: 22 }}>
                Set a password so you can sign in with email next time.
              </Text>
              <View style={{ gap: 8 }}>
                <TextField
                  leadingAccessory={<Lock size={18} color={Colors.$textPrimary} />}
                  trailingAccessory={
                    <TouchableOpacity
                      onPress={() => setShowPassword((v) => !v)}
                      style={{ justifyContent: 'center', paddingHorizontal: 4 }}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color={Colors.$textPrimary} />
                      ) : (
                        <Eye size={18} color={Colors.$textPrimary} />
                      )}
                    </TouchableOpacity>
                  }
                  placeholder="Password"
                  value={password}
                  onChangeText={(v) => {
                    setError(null)
                    setPasswordValue(v)
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  floatingPlaceholder
                  containerStyle={fieldStyle}
                />
                <PasswordStrengthGauge
                  password={password}
                  policy={DEFAULT_POLICY}
                  focused={passwordFocused}
                />
              </View>
              <TextField
                leadingAccessory={<Lock size={18} color={Colors.$textPrimary} />}
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={(v) => {
                  setError(null)
                  setConfirmPassword(v)
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                floatingPlaceholder
                containerStyle={fieldStyle}
              />
            </>
          )}

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <>
              <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.$textDefault }}>
                Your identity
              </Text>
              <Text style={{ color: Colors.$textNeutral, lineHeight: 22 }}>
                How should others know you on Card Mania?
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
          {step === 2 && (
            <>
              <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.$textDefault }}>
                About you
              </Text>
              <Text style={{ color: Colors.$textNeutral, lineHeight: 22 }}>
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
          {step === 3 && (
            <>
              <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.$textDefault }}>
                How you collect
              </Text>
              <Text style={{ color: Colors.$textNeutral, lineHeight: 22 }}>
                Select all that apply — you can change this any time.
              </Text>
              <View style={{ gap: 10 }}>
                <CollectorChip
                  label="Hobbyist"
                  description="Building specific sets or collections. Nearby sellers can find you when they have cards you want."
                  icon={
                    <Star
                      size={18}
                      color={isHobbyist ? Colors.$backgroundPrimaryHeavy : Colors.$iconNeutral}
                    />
                  }
                  active={isHobbyist}
                  onPress={() => setIsHobbyist((v) => !v)}
                />
                <CollectorChip
                  label="Trader"
                  description="Buy and sell actively for margins. Your storefront is more publicly visible to hobbyists and other traders."
                  icon={
                    <TrendingUp
                      size={18}
                      color={isTrader ? Colors.$backgroundPrimaryHeavy : Colors.$iconNeutral}
                    />
                  }
                  active={isTrader}
                  onPress={() => setIsTrader((v) => !v)}
                />
              </View>
            </>
          )}

          {/* ── Step 4: Location ── */}
          {step === 4 && (
            <>
              <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.$textDefault }}>
                Your location
              </Text>
              <Text style={{ color: Colors.$textNeutral, lineHeight: 22 }}>
                Connects you with nearby collectors and sellers. You can update this any time in
                Settings.
              </Text>
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.rgba(Colors.$outlineNeutral, 0.3),
                  backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                  paddingHorizontal: 8,
                }}
              >
                <LocationPicker>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 }}
                  >
                    <MapPin size={16} color={Colors.$iconNeutral} />
                    <Text style={{ color: Colors.$textNeutral }}>Location</Text>
                  </View>
                </LocationPicker>
              </View>
            </>
          )}

          {/* ── Step 5: Shipping address ── */}
          {step === 5 && (
            <>
              <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.$textDefault }}>
                Shipping address
              </Text>
              <Text style={{ color: Colors.$textNeutral, lineHeight: 22 }}>
                Pre-filled when you confirm a trade. You can update this before shipping.
              </Text>
              <TextField
                placeholder="Street address"
                value={address.street}
                onChangeText={(v) => setAddress((a) => ({ ...a, street: v }))}
                autoCapitalize="words"
                floatingPlaceholder
                containerStyle={fieldStyle}
              />
              <TextField
                placeholder="Apt / Suite (optional)"
                value={address.apt ?? ''}
                onChangeText={(v) => setAddress((a) => ({ ...a, apt: v }))}
                autoCapitalize="words"
                floatingPlaceholder
                containerStyle={fieldStyle}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 2 }}>
                  <TextField
                    placeholder="City"
                    value={address.city}
                    onChangeText={(v) => setAddress((a) => ({ ...a, city: v }))}
                    autoCapitalize="words"
                    floatingPlaceholder
                    containerStyle={fieldStyle}
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
                    containerStyle={fieldStyle}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    placeholder="ZIP / Postal"
                    value={address.postal_code}
                    onChangeText={(v) => setAddress((a) => ({ ...a, postal_code: v }))}
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                    floatingPlaceholder
                    containerStyle={fieldStyle}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <TextField
                    placeholder="Country"
                    value={address.country}
                    onChangeText={(v) => setAddress((a) => ({ ...a, country: v }))}
                    autoCapitalize="words"
                    floatingPlaceholder
                    containerStyle={fieldStyle}
                  />
                </View>
              </View>
            </>
          )}

          {/* Error */}
          {error ? (
            <Text style={{ color: Colors.$textDanger, fontSize: 13, textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}
        </View>

        {/* Navigation footer */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          <StepDots current={step} />

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {step > startStep + 1 && (
              <Pressable onPress={handleSkip}>
                <Text style={{ fontSize: 13, color: Colors.$textNeutral }}>Skip</Text>
              </Pressable>
            )}
            {step > startStep && (
              <Pressable
                onPress={handleBack}
                disabled={saving}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: Colors.rgba(Colors.$outlineNeutral, 0.5),
                }}
              >
                <Text style={{ fontSize: 14, color: Colors.$textDefault }}>Back</Text>
              </Pressable>
            )}
            <Pressable
              onPress={step < TOTAL_STEPS - 1 ? handleNext : handleFinish}
              disabled={saving}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 9,
                borderRadius: 8,
                backgroundColor: Colors.$backgroundPrimaryHeavy,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {saving && <Spinner style={{ width: 14, height: 14 }} />}
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                {saving ? 'Saving…' : step < TOTAL_STEPS - 1 ? 'Next' : 'Finish'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}
