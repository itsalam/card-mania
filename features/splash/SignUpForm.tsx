import { TextField } from '@/components/ui/input/base-input'
import { Text } from '@/components/ui/text/base-text'
import { useUserStore } from '@/lib/store/useUserStore'
import { AtSign, ChevronLeft, Eye, EyeOff, Lock, User } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Button, Colors } from 'react-native-ui-lib'

type Props = {
  onBack: () => void
}

function friendlyAuthError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('unique'))
    return 'An account with this email already exists.'
  if (msg.includes('password') && (msg.includes('6') || msg.includes('weak') || msg.includes('short')))
    return 'Password must be at least 6 characters.'
  if (msg.includes('valid email') || msg.includes('email address'))
    return 'Please enter a valid email address.'
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch'))
    return 'Network error. Please check your connection and try again.'
  return message
}

export function SignUpForm({ onBack }: Props) {
  const { signUp } = useUserStore()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSignUp = async () => {
    setError(null)
    if (!email.trim()) return setError('Please enter your email.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')

    setLoading(true)
    try {
      const { needsEmailConfirmation } = await signUp(
        email.trim(),
        password,
        displayName.trim() || undefined
      )
      if (needsEmailConfirmation) {
        setSuccessMsg(
          'Almost there! Check your inbox and click the confirmation link to activate your account.'
        )
      }
      // If email confirmation is disabled, AuthGate auto-navigates once setAuth
      // is called inside signUp — nothing else needed here.
    } catch (err: any) {
      setError(friendlyAuthError(err?.message ?? 'Sign up failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  // ── Email-confirmation holding state ─────────────────────────────────────
  if (successMsg) {
    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        className="flex flex-col items-center gap-6 px-8 w-full"
      >
        <Text className="text-white text-2xl text-center">Check your inbox ✉️</Text>
        <Text className="text-white text-center opacity-80 leading-6">{successMsg}</Text>
        <Button
          onPress={onBack}
          color={Colors.$backgroundPrimaryHeavy}
          className="w-full flex flex-row justify-center"
          label="Back to Sign In"
        />
      </MotiView>
    )
  }

  // ── Sign-up form ──────────────────────────────────────────────────────────
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
      {/* Header row */}
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
        {/* Spacer to balance header */}
        <View className="w-16" />
      </View>

      {/* Display name */}
      <TextField
        leadingAccessory={<User size={20} color={Colors.$textPrimary} />}
        placeholder="Display name (optional)"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        floatingPlaceholder
        containerStyle={{ backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4) }}
      />

      {/* Email */}
      <TextField
        leadingAccessory={<AtSign size={20} color={Colors.$textPrimary} />}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        floatingPlaceholder
        containerStyle={{ backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4) }}
      />

      {/* Password */}
      <TextField
        leadingAccessory={<Lock size={20} color={Colors.$textPrimary} />}
        trailingAccessory={
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
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
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        floatingPlaceholder
        containerStyle={{ backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4) }}
      />

      {/* Confirm password */}
      <TextField
        leadingAccessory={<Lock size={20} color={Colors.$textPrimary} />}
        placeholder="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        floatingPlaceholder
        containerStyle={{ backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4) }}
      />

      {/* Inline error */}
      {error ? (
        <Text className="text-red-400 text-sm text-center w-full">{error}</Text>
      ) : null}

      {/* Submit */}
      <Button
        onPress={handleSignUp}
        disabled={loading}
        color={Colors.$backgroundPrimaryHeavy}
        className="w-full flex flex-row justify-center"
        label={loading ? 'Creating account…' : 'Create account'}
      />
    </MotiView>
  )
}
