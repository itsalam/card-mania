import { Button as AppButton } from '@/components/ui/button'
import { TextField, TextFieldHandle } from '@/components/ui/input/base-input'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { AtSign, ChevronLeft, Eye, EyeOff, Lock, Phone, RefreshCw } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useEffect, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Svg, { G, Path } from 'react-native-svg'
import { Colors } from 'react-native-ui-lib'
import { CountryPicker } from './CountryPicker'
import { OtpInput } from './OtpInput'
import { PasswordStrengthGauge } from './PasswordStrengthGauge'
import { COUNTRIES, Country, formatLocalNumber, isValidE164, toE164 } from './phoneUtils'
import { DEFAULT_POLICY, policyError } from './usePasswordPolicy'

type TabMode = 'email' | 'phone'

type Props = {
  onBack: () => void
  onSuccess?: () => void
  onPhone?: (e164: string) => void
  initialEmail?: string
}

function friendlyAuthError(message: string): string {
  const msg = message.toLowerCase()
  if (
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('unique')
  )
    return 'An account with this email already exists.'
  if (msg.includes('valid email') || msg.includes('email address'))
    return 'Please enter a valid email address.'
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch'))
    return 'Network error. Please check your connection and try again.'
  return message
}

function friendlyOtpError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('invalid') || msg.includes('expired') || msg.includes('token'))
    return 'Incorrect or expired code. Please try again.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Network error. Please check your connection.'
  return message
}

// ── Pill toggle ────────────────────────────────────────────────────────────────

function PillToggle({ value, onChange }: { value: TabMode; onChange: (v: TabMode) => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 20,
        padding: 3,
        alignSelf: 'flex-start',
      }}
    >
      {(['email', 'phone'] as TabMode[]).map((tab) => {
        const active = value === tab
        const color = active ? '#000' : 'rgba(255,255,255,0.6)'
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onChange(tab)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingVertical: 5,
              paddingHorizontal: 14,
              borderRadius: 17,
              backgroundColor: active ? 'white' : 'transparent',
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {tab === 'email' ? (
              <AtSign size={12} color={color} />
            ) : (
              <Phone size={12} color={color} />
            )}
            <Text style={{ color, fontWeight: '600', fontSize: 12 }}>
              {tab === 'email' ? 'Email' : 'Phone'}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ── Main form ──────────────────────────────────────────────────────────────────

export function SignUpForm({ onBack, onSuccess, onPhone, initialEmail }: Props) {
  const { signUp, verifySignUpOtp } = useUserStore()

  const [tabMode, setTabMode] = useState<TabMode>('email')

  // Email state
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [code, setCode] = useState('')
  const confirmEmailRef = useRef<TextFieldHandle>(null)
  const passwordRef = useRef<TextFieldHandle>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Phone tab state
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [localNumber, setLocalNumber] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tabSwitchDir = useRef<1 | -1>(1)

  const maxDigits = country.format.split('').filter((c) => c === 'X').length
  const phoneE164 = toE164(country.dial, localNumber)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((n) => n - 1), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  const handleSubmitForm = async () => {
    setError(null)

    if (tabMode === 'phone') {
      if (!isValidE164(phoneE164)) return setError('Please enter a valid phone number.')
      onPhone?.(phoneE164)
      return
    }

    if (!email.trim()) return setError('Please enter your email.')
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase())
      return setError('Emails do not match.')
    if (!password) return setError('Please enter a password.')
    const pwErr = policyError(password, DEFAULT_POLICY)
    if (pwErr) return setError(pwErr)

    setLoading(true)
    try {
      const { needsEmailConfirmation } = await signUp(email.trim(), password)
      if (needsEmailConfirmation) {
        setResendCooldown(60)
        setStep('otp')
      }
      // If no confirmation needed, onAuthStateChange will close the gate automatically
    } catch (err: any) {
      setError(friendlyAuthError(err?.message ?? 'Sign up failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (token: string) => {
    setError(null)
    setLoading(true)
    try {
      await verifySignUpOtp(email.trim(), token)
      onSuccess?.()
    } catch (err: any) {
      setCode('')
      setError(friendlyOtpError(err?.message ?? 'Verification failed.'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    const { error: resendError } = await getSupabase().auth.resend({
      email: email.trim(),
      type: 'signup',
    })
    if (resendError) {
      setError('Could not resend code. Please try again.')
    } else {
      setResendCooldown(60)
      setCode('')
      setError(null)
    }
  }

  const handleBackFromOtp = () => {
    setStep('form')
    setCode('')
    setError(null)
  }

  // ── OTP step ──────────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <MotiView
        from={{ opacity: 0, translateX: 40 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 260, mass: 0.9 }}
        style={{
          gap: 24,
          alignItems: 'center',
          paddingHorizontal: 32,
          width: '100%',
          paddingBottom: 32,
          height: '50%',
        }}
      >
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity
            onPress={handleBackFromOtp}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            accessibilityLabel="Back to sign up form"
          >
            <ChevronLeft size={16} color="white" />
            <Text style={{ color: 'white', fontSize: 14 }}>Back</Text>
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: 20 }}>Verify email</Text>
          <View style={{ width: 56 }} />
        </View>

        <Text style={{ color: 'white', textAlign: 'center', opacity: 0.7, lineHeight: 24 }}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={{ color: 'white', fontWeight: '600', opacity: 1 }}>{email.trim()}</Text>
        </Text>

        <OtpInput value={code} onChange={setCode} onComplete={handleVerifyOtp} />

        {error ? (
          <Text style={{ color: '#f87171', fontSize: 14, textAlign: 'center', width: '100%' }}>
            {error}
          </Text>
        ) : null}

        <AppButton
          variant="primary"
          size="lg"
          onPress={() => code.length === 6 && handleVerifyOtp(code)}
          disabled={loading || code.length < 6}
          className="w-full"
        >
          {loading ? 'Verifying…' : 'Verify'}
        </AppButton>

        <TouchableOpacity
          onPress={handleResend}
          disabled={resendCooldown > 0}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <RefreshCw size={14} color={resendCooldown > 0 ? 'rgba(255,255,255,0.3)' : 'white'} />
          <Text
            style={{ color: resendCooldown > 0 ? 'rgba(255,255,255,0.3)' : 'white', fontSize: 13 }}
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </Text>
        </TouchableOpacity>
      </MotiView>
    )
  }

  // ── Form step ──────────────────────────────────────────────────────────────────
  return (
    <MotiView
      from={{ opacity: 0, translateX: 40 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 260, mass: 0.9 }}
      style={{
        gap: 16,
        alignItems: 'center',
        // paddingHorizontal: 32,
        width: '100%',
        paddingBottom: 32,
      }}
    >
      {/* ← Sign in button */}
      <TouchableOpacity
        onPress={onBack}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)',
          alignSelf: 'flex-start',
        }}
        accessibilityLabel="Back to sign in"
      >
        <ChevronLeft size={13} color="white" />
        <Text style={{ color: 'white', fontSize: 13 }}>Sign in</Text>
      </TouchableOpacity>

      <Text
        style={{ color: 'white', fontSize: 24, lineHeight: 26, fontWeight: 'bold', width: '100%' }}
      >
        {initialEmail ? "Looks like you're new here" : 'Create account'}
      </Text>

      {/* Pill toggle — only shown when not coming from an email redirect */}
      {!initialEmail && (
        <PillToggle
          value={tabMode}
          onChange={(t) => {
            tabSwitchDir.current = t === 'phone' ? 1 : -1
            setTabMode(t)
            setError(null)
          }}
        />
      )}

      {/* Input fields — animate on tab switch */}
      <MotiView
        key={tabMode}
        from={{ opacity: 0, translateX: tabSwitchDir.current * 30 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 270, mass: 0.9 }}
        style={{ width: '100%', gap: 10 }}
      >
        {tabMode === 'email' ? (
          <>
            <TextField
              leadingAccessory={<AtSign size={20} color={Colors.$textPrimary} />}
              placeholder="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v)
                if (error) setError(null)
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              floatingPlaceholder
              returnKeyType="next"
              onSubmitEditing={() => confirmEmailRef.current?.focus()}
              containerStyle={{
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                width: '100%',
              }}
            />
            <TextField
              ref={confirmEmailRef}
              leadingAccessory={<AtSign size={20} color={Colors.$textPrimary} />}
              placeholder="Confirm email"
              value={confirmEmail}
              onChangeText={(v) => {
                setConfirmEmail(v)
                if (error) setError(null)
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              floatingPlaceholder
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accentColor={
                confirmEmail && email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()
                  ? Colors.$textDanger
                  : undefined
              }
              containerStyle={{
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                width: '100%',
              }}
            />
            <TextField
              ref={passwordRef}
              leadingAccessory={<Lock size={20} color={Colors.$textPrimary} />}
              trailingAccessory={
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  style={{ paddingHorizontal: 4 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.$textPrimary} />
                  ) : (
                    <Eye size={20} color={Colors.$textPrimary} />
                  )}
                </TouchableOpacity>
              }
              placeholder="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v)
                if (error) setError(null)
              }}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              floatingPlaceholder
              returnKeyType="done"
              onSubmitEditing={handleSubmitForm}
              containerStyle={{
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                width: '100%',
              }}
            />
            <PasswordStrengthGauge
              password={password}
              policy={DEFAULT_POLICY}
              focused={passwordFocused}
            />
          </>
        ) : (
          <TextField
            leadingAccessory={
              <CountryPicker
                selected={country}
                onSelect={(c) => {
                  setCountry(c)
                  setLocalNumber('')
                }}
              />
            }
            placeholder="Phone number"
            value={formatLocalNumber(localNumber, country.format)}
            onChangeText={(v) => {
              setError(null)
              setLocalNumber(v.replace(/\D/g, '').slice(0, maxDigits))
            }}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
            floatingPlaceholder
            containerStyle={{
              backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
              width: '100%',
            }}
          />
        )}
      </MotiView>

      {error ? (
        <Text style={{ color: '#f87171', fontSize: 14, textAlign: 'center', width: '100%' }}>
          {error}
        </Text>
      ) : null}

      <AppButton
        variant="primary"
        size="lg"
        onPress={handleSubmitForm}
        disabled={loading || (tabMode === 'phone' && !localNumber.trim())}
        className="w-full"
      >
        {loading ? 'Creating account…' : 'Continue'}
      </AppButton>

      <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 24 }}>
        <Separator orientation="horizontal" className="flex-1 bg-white" />
        <Text style={{ color: 'white' }}>or</Text>
        <Separator orientation="horizontal" className="flex-1 bg-white" />
      </View>

      <AppButton variant="secondary" size="lg" disabled className="w-full">
        <View style={{ width: 20, height: 20 }}>
          <Svg viewBox="0 0 48 48">
            <Path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <Path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <Path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <Path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <Path fill="none" d="M0 0h48v48H0z" />
          </Svg>
        </View>
        <Text>Continue with Google</Text>
      </AppButton>

      <AppButton variant="secondary" size="lg" disabled className="w-full">
        <View style={{ width: 20, height: 20 }}>
          <Svg viewBox="0 0 48 48" fill="#000000">
            <G id="SVGRepo_iconCarrier">
              <G fill="none" fillRule="evenodd">
                <G transform="translate(-200.000000, -160.000000)" fill="#4460A0">
                  <Path d="M225.638355,208 L202.649232,208 C201.185673,208 200,206.813592 200,205.350603 L200,162.649211 C200,161.18585 201.185859,160 202.649232,160 L245.350955,160 C246.813955,160 248,161.18585 248,162.649211 L248,205.350603 C248,206.813778 246.813769,208 245.350955,208 L233.119305,208 L233.119305,189.411755 L239.358521,189.411755 L240.292755,182.167586 L233.119305,182.167586 L233.119305,177.542641 C233.119305,175.445287 233.701712,174.01601 236.70929,174.01601 L240.545311,174.014333 L240.545311,167.535091 C239.881886,167.446808 237.604784,167.24957 234.955552,167.24957 C229.424834,167.24957 225.638355,170.625526 225.638355,176.825209 L225.638355,182.167586 L219.383122,182.167586 L219.383122,189.411755 L225.638355,189.411755 L225.638355,208 Z" />
                </G>
              </G>
            </G>
          </Svg>
        </View>
        <Text>Continue with Facebook</Text>
      </AppButton>
    </MotiView>
  )
}
