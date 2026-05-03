import { Button as AppButton } from '@/components/ui/button'
import { TextField } from '@/components/ui/input/base-input'
import { Text } from '@/components/ui/text/base-text'
import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { AtSign, ChevronLeft, Eye, EyeOff, Lock, RefreshCw } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useEffect, useRef, useState } from 'react'
import { Pressable, TextInput, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { PasswordStrengthGauge } from './PasswordStrengthGauge'
import { DEFAULT_POLICY, policyError, usePasswordPolicy } from './usePasswordPolicy'

type Props = {
  onBack: () => void
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

// ── OTP digit input ───────────────────────────────────────────────────────────

const CODE_LENGTH = 6

type OtpInputProps = {
  value: string
  onChange: (v: string) => void
  onComplete: (v: string) => void
}

function OtpInput({ value, onChange, onComplete }: OtpInputProps) {
  const ref = useRef<TextInput>(null)

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}
    >
      {Array.from({ length: CODE_LENGTH }, (_, i) => {
        const char = value[i]
        const isActive = i === value.length
        return (
          <View
            key={i}
            style={{
              width: 44,
              height: 54,
              borderRadius: 10,
              backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
              borderWidth: 1.5,
              borderColor: isActive
                ? Colors.$textPrimary
                : char
                  ? 'rgba(255,255,255,0.35)'
                  : 'rgba(255,255,255,0.15)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 22, fontWeight: '600' }}>{char ?? ''}</Text>
          </View>
        )
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, CODE_LENGTH)
          onChange(digits)
          if (digits.length === CODE_LENGTH) onComplete(digits)
        }}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        caretHidden
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
      />
    </Pressable>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function SignUpForm({ onBack }: Props) {
  const { signUp, verifySignUpOtp } = useUserStore()
  const { data: policy = DEFAULT_POLICY } = usePasswordPolicy()

  const [step, setStep] = useState<'form' | 'otp'>('form')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  const [code, setCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((n) => n - 1), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  const handleSubmitForm = async () => {
    setError(null)
    if (!email.trim()) return setError('Please enter your email.')
    const pwErr = policyError(password, policy)
    if (pwErr) return setError(pwErr)
    if (password !== confirmPassword) return setError('Passwords do not match.')

    setLoading(true)
    try {
      await signUp(email.trim(), password)
      setResendCooldown(60)
      setStep('otp')
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
      // onAuthStateChange fires → setAuth → AuthGate shows the profile wizard
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

  // ── OTP step ────────────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <MotiView
        from={{ opacity: 0, translateX: 40 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 260, mass: 0.9 }}
        className="flex flex-col items-center gap-6 px-8 w-full"
      >
        <View className="w-full flex flex-row items-center justify-between">
          <TouchableOpacity
            onPress={handleBackFromOtp}
            className="flex flex-row items-center gap-1"
            accessibilityLabel="Back to sign up form"
          >
            <ChevronLeft size={16} color="white" />
            <Text className="text-white text-sm">Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl">Verify email</Text>
          <View className="w-16" />
        </View>

        <Text className="text-white text-center opacity-70 leading-6">
          Enter the 6-digit code sent to{'\n'}
          <Text className="text-white font-semibold opacity-100">{email.trim()}</Text>
        </Text>

        <OtpInput value={code} onChange={setCode} onComplete={handleVerifyOtp} />

        {error ? <Text className="text-red-400 text-sm text-center w-full">{error}</Text> : null}

        <AppButton
          variant="primary"
          size="lg"
          onPress={() => code.length === CODE_LENGTH && handleVerifyOtp(code)}
          disabled={loading || code.length < CODE_LENGTH}
          className="w-full"
        >
          {loading ? 'Verifying…' : 'Verify'}
        </AppButton>

        <TouchableOpacity
          onPress={handleResend}
          disabled={resendCooldown > 0}
          className="flex flex-row items-center gap-2"
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

  // ── Form step ───────────────────────────────────────────────────────────────
  return (
    <MotiView
      from={{ opacity: 0, translateY: 40 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: 'spring',
        damping: 100,
        stiffness: 300,
        mass: 0.9,
        overshootClamping: true,
      }}
      className="flex flex-col items-center gap-4 px-8 w-full"
    >
      <View className="w-full flex flex-row items-center justify-between">
        <TouchableOpacity
          onPress={onBack}
          className="flex flex-row items-center gap-1"
          accessibilityLabel="Back to sign in"
        >
          <ChevronLeft size={16} color="white" />
          <Text className="text-white text-sm">Sign in</Text>
        </TouchableOpacity>
        <Text className="text-white text-xl">Create account</Text>
        <View className="w-16" />
      </View>

      <View style={{ width: '100%', gap: 8 }}>
        <TextField
          leadingAccessory={<AtSign size={20} color={Colors.$textPrimary} />}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          floatingPlaceholder
          containerStyle={{
            backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
            minHeight: 60,
          }}
        />
        <View>
          <TextField
            leadingAccessory={<Lock size={20} color={Colors.$textPrimary} />}
            trailingAccessory={
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={{ alignContent: 'center', justifyContent: 'center', paddingHorizontal: 4 }}
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
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            floatingPlaceholder
            containerStyle={{
              backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
              minHeight: 60,
            }}
          />

          <PasswordStrengthGauge password={password} policy={policy} focused={passwordFocused} />
        </View>
        <TextField
          leadingAccessory={<Lock size={20} color={Colors.$textPrimary} />}
          placeholder="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          floatingPlaceholder
          containerStyle={{
            backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
            minHeight: 60,
          }}
        />
      </View>

      {error ? <Text className="text-red-400 text-sm text-center w-full">{error}</Text> : null}

      <AppButton
        variant="primary"
        size="lg"
        onPress={handleSubmitForm}
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Sending code…' : 'Continue'}
      </AppButton>
    </MotiView>
  )
}
