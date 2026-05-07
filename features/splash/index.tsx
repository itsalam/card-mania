import Logo from '@/assets/images/logo.svg'
import { GradientBackground } from '@/components/Background'
import { Button as AppButton } from '@/components/ui/button'
import { TextField } from '@/components/ui/input/base-input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Text } from '@/components/ui/text/base-text'
import { ProfileSetupWizard } from '@/features/onboarding'
import { useUserStore } from '@/lib/store/useUserStore'
import { cn } from '@/lib/utils'
import { AtSign, Eye, EyeOff, Lock, User } from 'lucide-react-native'
import { MotiView } from 'moti'
import { ComponentProps, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { G, Path } from 'react-native-svg'
import { Colors } from 'react-native-ui-lib'
import { SignUpForm } from './SignUpForm'

// ── Auth gate ─────────────────────────────────────────────────────────────────

export function AuthGate({ children }: { children: React.ReactNode }) {
  const hydrated = useUserStore((s) => s.hydrated)
  const status = useUserStore((s) => s.status)
  const user = useUserStore((s) => s.user)
  const profileSetupComplete = useUserStore((s) => s.profileSetupComplete)

  // Spin while: store not hydrated, auth loading, or profile settings not yet fetched
  const initializing =
    !hydrated || status === 'loading' || (!!user && profileSetupComplete === null)

  if (initializing)
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <Spinner />
      </SafeAreaView>
    )
  if (!user) return <SplashPage />
  if (!profileSetupComplete) return <ProfileSetupWizard />
  return <>{children}</>
}

// ── Shared button primitive ────────────────────────────────────────────────────

const BaseButton = ({ className, ...props }: ComponentProps<typeof AppButton>) => (
  <AppButton variant="primary" size="lg" className={cn('w-full', className)} {...props} />
)

// ── OAuth stubs ───────────────────────────────────────────────────────────────

const GoogleSignInButton = () => (
  <BaseButton variant="secondary">
    <View className="w-5 h-5">
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
    <Text>Sign in with Google</Text>
  </BaseButton>
)

const FacebookSignInButton = () => (
  <BaseButton variant="secondary">
    <View className="w-5 h-5">
      <Svg viewBox="0 0 48 48" fill="#000000">
        <G id="SVGRepo_iconCarrier">
          <G fill="none" fillRule="evenodd">
            <G transform="translate(-200.000000, -160.000000)" fill="#4460A0">
              <Path
                d="M225.638355,208 L202.649232,208 C201.185673,208 200,206.813592 200,205.350603
                 L200,162.649211 C200,161.18585 201.185859,160 202.649232,160 L245.350955,160
                 C246.813955,160 248,161.18585 248,162.649211 L248,205.350603
                 C248,206.813778 246.813769,208 245.350955,208 L233.119305,208
                 L233.119305,189.411755 L239.358521,189.411755 L240.292755,182.167586
                 L233.119305,182.167586 L233.119305,177.542641
                 C233.119305,175.445287 233.701712,174.01601 236.70929,174.01601
                 L240.545311,174.014333 L240.545311,167.535091
                 C239.881886,167.446808 237.604784,167.24957 234.955552,167.24957
                 C229.424834,167.24957 225.638355,170.625526 225.638355,176.825209
                 L225.638355,182.167586 L219.383122,182.167586 L219.383122,189.411755
                 L225.638355,189.411755 L225.638355,208 Z"
              />
            </G>
          </G>
        </G>
      </Svg>
    </View>
    <Text>Sign in with Facebook</Text>
  </BaseButton>
)

// ── Error helper ──────────────────────────────────────────────────────────────

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

// ── Splash / login page ───────────────────────────────────────────────────────

export function SplashPage() {
  const { signInAnonymously, signIn } = useUserStore()
  const isDev = process.env.NODE_ENV !== 'production'

  const [view, setView] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shakeX = useSharedValue(0)
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }))

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 45 }),
      withTiming(10, { duration: 45 }),
      withTiming(-8, { duration: 45 }),
      withTiming(8, { duration: 45 }),
      withTiming(0, { duration: 45 })
    )
  }

  const handleAnonSignIn = async () => {
    try {
      isDev && (await signInAnonymously())
    } catch (err) {
      console.error('Anonymous sign in failed:', err)
    }
  }

  const handleSignIn = async () => {
    setError(null)
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      triggerShake()
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim(), password)
    } catch (err: any) {
      setError(friendlySignInError(err?.message ?? 'Sign in failed.'))
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  // ── Sign-up view ─────────────────────────────────────────────────────────
  if (view === 'signup') {
    return (
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <GradientBackground style={{ justifyContent: 'center', gap: 16 }}>
          <MotiView
            style={{ alignItems: 'center' }}
            from={{ opacity: 0, translateY: 100 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{
              type: 'spring',
              damping: 100,
              stiffness: 300,
              mass: 0.9,
              overshootClamping: true,
            }}
          >
            <Logo width={128} height={128} />
          </MotiView>
          <SignUpForm onBack={() => setView('login')} />
        </GradientBackground>
      </KeyboardAvoidingView>
    )
  }

  // ── Login view ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <GradientBackground style={{ justifyContent: 'center', gap: 16 }}>
        <MotiView
          style={{ alignItems: 'center' }}
          from={{ opacity: 0, translateY: 100 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{
            type: 'spring',
            damping: 100,
            stiffness: 300,
            mass: 0.9,
            overshootClamping: true,
          }}
        >
          <Logo width={256} height={256} />
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 100 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{
            delay: 100,
            type: 'spring',
            damping: 100,
            stiffness: 300,
            mass: 0.9,
            overshootClamping: true,
          }}
          className="flex flex-col items-center justify-center px-8 gap-4 w-full"
        >
          {/* Header row */}
          <View className="w-full px-4 flex flex-row justify-between items-center">
            <Text className="text-white text-2xl">Log in to CardMania</Text>
            <AppButton
              variant="outline"
              size="sm"
              onPress={() => setView('signup')}
              accessibilityLabel="Create a new account"
            >
              <AtSign size={14} color="white" />
              <Text className="text-sm">Sign up</Text>
            </AppButton>
          </View>

          {/* Email + Password */}
          <Animated.View style={[{ width: '100%', gap: 8 }, shakeStyle]}>
            <TextField
              leadingAccessory={
                <User size={20} onPress={handleAnonSignIn} color={Colors.$textPrimary} />
              }
              placeholder="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t)
                if (error) setError(null)
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              showClearButton
              floatingPlaceholder
              accentColor={error ? Colors.$textDanger : undefined}
              containerStyle={{
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                minHeight: 60,
              }}
            />
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
              onChangeText={(t) => {
                setPassword(t)
                if (error) setError(null)
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              floatingPlaceholder
              accentColor={error ? Colors.$textDanger : undefined}
              containerStyle={{
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                minHeight: 60,
              }}
            />
          </Animated.View>

          {/* Inline error — space always reserved to avoid layout shift */}
          <MotiView
            animate={{ opacity: error ? 1 : 0, translateY: error ? 0 : -6 }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ minHeight: 20, width: '100%', justifyContent: 'center' }}
            pointerEvents="none"
          >
            <Text className="text-red-400 text-sm text-center w-full px-4">{error ?? ''}</Text>
          </MotiView>

          {/* Sign in button */}
          <BaseButton onPress={handleSignIn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </BaseButton>

          {/* Divider */}
          <View className="w-full flex flex-row items-center gap-6 justify-center">
            <Separator orientation="horizontal" className="flex-1 background-white" />
            <Text className="text-white">or</Text>
            <Separator orientation="horizontal" className="flex-1 background-white" />
          </View>

          <GoogleSignInButton />
          <FacebookSignInButton />
        </MotiView>
      </GradientBackground>
    </KeyboardAvoidingView>
  )
}
