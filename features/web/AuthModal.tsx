import { Button as AppButton } from '@/components/ui/button'
import { TextField } from '@/components/ui/input/base-input'
import { Text } from '@/components/ui/text/base-text'
import { SignUpForm } from '@/features/splash/SignUpForm'
import { useUserStore } from '@/lib/store/useUserStore'
import { AtSign, Eye, EyeOff, Lock, X } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useState } from 'react'
import { Pressable, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

function friendlySignInError(message: string): string {
  const msg = message.toLowerCase()
  if (
    msg.includes('invalid login') ||
    msg.includes('invalid credentials') ||
    msg.includes('email not confirmed') ||
    msg.includes('wrong password')
  )
    return 'Invalid email or password.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Network error. Please check your connection.'
  return message
}

type Props = {
  onClose: () => void
}

export function AuthModal({ onClose }: Props) {
  const { signIn } = useUserStore()
  const [view, setView] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setError(null)
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      onClose()
    } catch (err: any) {
      setError(friendlySignInError(err?.message ?? 'Sign in failed.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Pressable
      onPress={onClose}
      style={{
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
      }}
    >
      <Pressable
        onPress={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: Colors.$backgroundDefault,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: Colors.$outlineDefault,
          padding: 24,
          gap: 4,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <X size={20} color={Colors.$textNeutral} />
          </Pressable>
        </View>

        {view === 'login' ? (
          <MotiView
            from={{ opacity: 0, translateX: -16 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ gap: 16 }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text variant="h2">Sign in</Text>
              <AppButton
                variant="outline"
                size="sm"
                onPress={() => {
                  setError(null)
                  setView('signup')
                }}
              >
                <AtSign size={14} color={Colors.$textDefault} />
                <Text style={{ fontSize: 13 }}>Sign up</Text>
              </AppButton>
            </View>

            <View style={{ gap: 8 }}>
              <TextField
                leadingAccessory={<AtSign size={20} color={Colors.$textPrimary} />}
                placeholder="Email"
                value={email}
                onChangeText={(t) => {
                  setEmail(t)
                  if (error) setError(null)
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                floatingPlaceholder
                accentColor={error ? Colors.$textDanger : undefined}
              />
              <TextField
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
                onChangeText={(t) => {
                  setPassword(t)
                  if (error) setError(null)
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                floatingPlaceholder
                accentColor={error ? Colors.$textDanger : undefined}
              />
            </View>

            {error ? (
              <Text style={{ color: Colors.$textDanger, fontSize: 13, textAlign: 'center' }}>
                {error}
              </Text>
            ) : null}

            <AppButton
              variant="primary"
              size="lg"
              onPress={handleSignIn}
              disabled={loading}
              style={{ width: '100%', marginTop: 4 }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </AppButton>
          </MotiView>
        ) : (
          <MotiView
            from={{ opacity: 0, translateX: 16 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 180 }}
          >
            <SignUpForm onBack={() => setView('login')} onSuccess={onClose} />
          </MotiView>
        )}
      </Pressable>
    </Pressable>
  )
}
