import { Button as AppButton } from '@/components/ui/button'
import { TextField, TextFieldHandle } from '@/components/ui/input/base-input'
import { Text } from '@/components/ui/text/base-text'
import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { AtSign, ChevronLeft, Eye, EyeOff, Lock, RefreshCw } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useEffect, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { PillToggle } from './components'
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

// ── Main form ──────────────────────────────────────────────────────────────────

export function SignUpForm({ onBack, onSuccess, onPhone, initialEmail }: Props) {
  const { signUp, verifySignUpOtp } = useUserStore()

  const [tabMode, setTabMode] = useState<TabMode>('email')

  // Email state
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [code, setCode] = useState('')
  const passwordRef = useRef<TextFieldHandle>(null)
  const confirmPasswordRef = useRef<TextFieldHandle>(null)
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
    if (!password) return setError('Please enter a password.')
    const pwErr = policyError(password, DEFAULT_POLICY)
    if (pwErr) return setError(pwErr)
    if (password !== confirmPassword) return setError('Passwords do not match.')

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
            <ChevronLeft size={16} color={Colors.$textDefault} />
            <Text style={{ color: Colors.$textDefault, fontSize: 14 }}>Back</Text>
          </TouchableOpacity>
          <Text style={{ color: Colors.$textDefault, fontSize: 20 }}>Verify email</Text>
          <View style={{ width: 56 }} />
        </View>

        <Text
          style={{ color: Colors.$textDefault, textAlign: 'center', opacity: 0.7, lineHeight: 24 }}
        >
          Enter the 6-digit code sent to{'\n'}
          <Text style={{ color: Colors.$textDefault, fontWeight: '600', opacity: 1 }}>
            {email.trim()}
          </Text>
        </Text>

        <OtpInput value={code} onChange={setCode} onComplete={handleVerifyOtp} />

        {error ? (
          <Text
            style={{ color: Colors.$textDanger, fontSize: 14, textAlign: 'center', width: '100%' }}
          >
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
          <RefreshCw
            size={14}
            color={resendCooldown > 0 ? Colors.rgba(Colors.$textDefault, 0.3) : Colors.$textDefault}
          />
          <Text
            style={{
              color:
                resendCooldown > 0 ? Colors.rgba(Colors.$textDefault, 0.3) : Colors.$textDefault,
              fontSize: 13,
            }}
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
          borderColor: Colors.rgba(Colors.$textDefault, 0.25),
          alignSelf: 'flex-start',
        }}
        accessibilityLabel="Back to sign in"
      >
        <ChevronLeft size={13} color={Colors.$textDefault} />
        <Text style={{ color: Colors.$textDefault, fontSize: 13 }}>Sign in</Text>
      </TouchableOpacity>

      <Text
        style={{
          color: Colors.$textDefault,
          fontSize: 24,
          lineHeight: 26,
          fontWeight: 'bold',
          width: '100%',
        }}
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
              onSubmitEditing={() => passwordRef.current?.focus()}
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
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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
            <TextField
              ref={confirmPasswordRef}
              leadingAccessory={<Lock size={20} color={Colors.$textPrimary} />}
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v)
                if (error) setError(null)
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              floatingPlaceholder
              returnKeyType="done"
              onSubmitEditing={handleSubmitForm}
              accentColor={
                confirmPassword && password !== confirmPassword ? Colors.$textDanger : undefined
              }
              containerStyle={{
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                width: '100%',
              }}
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
        <Text
          style={{ color: Colors.$textDanger, fontSize: 14, textAlign: 'center', width: '100%' }}
        >
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
    </MotiView>
  )
}
