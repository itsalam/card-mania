import Logo from '@/assets/images/logo-min.svg'
import { GradientBackground } from '@/components/Background'
import { Button as AppButton } from '@/components/ui/button'
import { TextField, TextFieldHandle } from '@/components/ui/input/base-input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Text } from '@/components/ui/text/base-text'
import { ProfileSetupWizard } from '@/features/onboarding'
import { useUserStore } from '@/lib/store/useUserStore'
import { cn } from '@/lib/utils'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AtSign, Eye, EyeOff, Lock, Phone, RefreshCw, User } from 'lucide-react-native'
import { MotiView } from 'moti'
import { ComponentProps, useEffect, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { G, Path } from 'react-native-svg'
import { Colors } from 'react-native-ui-lib'
import { CountryPicker } from './CountryPicker'
import { OtpInput } from './OtpInput'
import { SignUpForm } from './SignUpForm'
import { COUNTRIES, Country, formatLocalNumber, isValidE164, toE164 } from './phoneUtils'
import { useEmailAuthFlow } from './useEmailAuthFlow'

function friendlyPhoneError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('invalid') && (msg.includes('phone') || msg.includes('number')))
    return 'Please enter a valid phone number.'
  if (msg.includes('rate') || msg.includes('too many'))
    return 'Too many attempts. Please wait before requesting another code.'
  if (msg.includes('not enabled') || msg.includes('phone provider') || msg.includes('sms'))
    return 'Phone sign-in is not yet configured. Please use email instead.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Network error. Please check your connection.'
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

function isBlockingPhoneError(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    msg.includes('rate') ||
    msg.includes('too many') ||
    msg.includes('not enabled') ||
    msg.includes('phone provider') ||
    msg.includes('sms') ||
    msg.includes('network') ||
    msg.includes('fetch')
  )
}

// ── Auth gate ─────────────────────────────────────────────────────────────────

export function AuthGate({ children }: { children: React.ReactNode }) {
  const hydrated = useUserStore((s) => s.hydrated)
  const status = useUserStore((s) => s.status)
  const user = useUserStore((s) => s.user)
  const profileSetupComplete = useUserStore((s) => s.profileSetupComplete)

  const initializing =
    !hydrated || status === 'loading' || (!!user && profileSetupComplete === null)

  if (initializing)
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <Spinner />
      </SafeAreaView>
    )
  if (!user || user.is_anonymous) return <SplashPage />
  if (!profileSetupComplete) return <ProfileSetupWizard />
  return <>{children}</>
}

// ── Shared primitives ─────────────────────────────────────────────────────────

const BaseButton = ({ className, ...props }: ComponentProps<typeof AppButton>) => (
  <AppButton variant="primary" size="lg" className={cn('w-full', className)} {...props} />
)

const GoogleSignInButton = () => (
  <BaseButton variant="secondary" disabled>
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
  <BaseButton variant="secondary" disabled>
    <View className="w-5 h-5">
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
    <Text>Sign in with Facebook</Text>
  </BaseButton>
)

// ── Splash / login page ───────────────────────────────────────────────────────

export function SplashPage({ initialSignUp }: { initialSignUp?: boolean }) {
  const { signInAnonymously, signInWithPhone, verifyPhoneOtp } = useUserStore()
  const [hasEverSignedIn, setHasEverSignedIn] = useState(false)
  useEffect(() => {
    AsyncStorage.getItem('cardmania:hasEverSignedIn').then((v: string | null) => {
      if (v) setHasEverSignedIn(true)
    })
  }, [])
  const isDev = process.env.NODE_ENV !== 'production'
  const { progress: kbProgress } = useReanimatedKeyboardAnimation()
  const logoKbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(kbProgress.value, [0, 1], [1, 0.6]) }],
  }))

  // 'phone' is the primary / default view
  const [view, setView] = useState<'phone' | 'signup'>('phone')

  // Main page tab
  const [mainTab, setMainTab] = useState<'phone' | 'email'>('phone')
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)

  // Phone state
  const [isNewUser, setIsNewUser] = useState(false)
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [localNumber, setLocalNumber] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Email auth — shared hook
  const emailFlow = useEmailAuthFlow()

  // Shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const direction = useRef<1 | -1>(1)
  const tabSwitchDir = useRef<1 | -1>(1)
  const passwordFieldRef = useRef<TextFieldHandle>(null)

  const maxDigits = country.format.split('').filter((c) => c === 'X').length
  const e164 = toE164(country.dial, localNumber)

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

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((n) => n - 1), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  const goTo = (v: typeof view, dir: 1 | -1 = 1) => {
    direction.current = dir
    setError(null)
    if (v !== 'phone') {
      setPhoneOtpSent(false)
      setPhoneCode('')
      setIsNewUser(false)
    }
    setView(v)
  }

  // When the email flow detects a new user, navigate to the signup view
  useEffect(() => {
    if (emailFlow.signupEmail) {
      direction.current = 1
      setView('signup')
    }
  }, [emailFlow.signupEmail])

  const handleAnonSignIn = async () => {
    try {
      isDev && (await signInAnonymously())
    } catch (err) {
      console.error('Anonymous sign in failed:', err)
    }
  }

  const handleSendCode = async () => {
    setError(null)
    if (!isValidE164(e164)) {
      console.warn('[handleSendCode] invalid E.164', { raw: localNumber, dial: country.dial, e164 })
      setError('Please enter a valid phone number.')
      return
    }
    console.log('[handleSendCode] initiating sign-in OTP', { e164 })
    setLoading(true)
    try {
      await signInWithPhone(e164, false)
      setResendCooldown(60)
      setPhoneOtpSent(true)
    } catch (firstErr: any) {
      const msg = firstErr?.message ?? ''
      console.error('[handleSendCode] caught error', {
        message: msg,
        isBlocking: isBlockingPhoneError(msg),
      })
      if (isBlockingPhoneError(msg)) {
        setError(friendlyPhoneError(msg || 'Failed to send code. Please try again.'))
      } else {
        // No account found — auto-create and still send OTP
        try {
          await signInWithPhone(e164, true)
          setIsNewUser(true)
          setResendCooldown(60)
          setPhoneOtpSent(true)
        } catch (createErr: any) {
          console.error('[handleSendCode] create error', { message: createErr?.message })
          setError(
            friendlyPhoneError(createErr?.message ?? 'Failed to send code. Please try again.')
          )
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyPhoneOtp = async (token: string) => {
    setError(null)
    console.log('[handleVerifyPhoneOtp] verifying', { e164, tokenLength: token.length })
    setLoading(true)
    try {
      await verifyPhoneOtp(e164, token)
    } catch (err: any) {
      console.error('[handleVerifyPhoneOtp] error', { message: err?.message })
      setPhoneCode('')
      setError(friendlyOtpError(err?.message ?? 'Verification failed.'))
    } finally {
      setLoading(false)
    }
  }

  const handleResendPhoneOtp = async () => {
    if (resendCooldown > 0) return
    console.log('[handleResendPhoneOtp] resending OTP', { e164, isNewUser })
    try {
      await signInWithPhone(e164, isNewUser)
      setResendCooldown(60)
      setPhoneCode('')
      setError(null)
    } catch (err: any) {
      console.error('[handleResendPhoneOtp] error', { message: err?.message })
      setError(friendlyPhoneError(err?.message ?? 'Could not resend code. Please try again.'))
    }
  }

  const handleResetPhoneOtp = () => {
    setPhoneOtpSent(false)
    setPhoneCode('')
    setIsNewUser(false)
    setError(null)
  }

  const handleSignIn = () => {
    emailFlow.handleSignIn()
  }

  // Shared logo node — flex:1 keeps it in the keyboard-avoiding flow so it moves with the form;
  // maxHeight caps the area so both screens place the logo at the same position.
  const logoNode = (
    <Animated.View
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 24,
        },
        logoKbStyle,
      ]}
    >
      <MotiView
        from={{ opacity: 0, translateY: 60 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 100, stiffness: 300, overshootClamping: true }}
      >
        <Logo width={192} height={192} />
      </MotiView>
    </Animated.View>
  )

  const formWrapStyle = {
    alignItems: 'center' as const,
    paddingHorizontal: 32,
    gap: 16,
    width: '100%' as const,
    paddingBottom: 32,
    height: '50%' as const,
  }

  // ── Sign-up ──────────────────────────────────────────────────────────────────
  if (view === 'signup') {
    return (
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <GradientBackground style={{ flex: 1 }}>
          {logoNode}
          <View style={{ height: '50%', paddingHorizontal: 24 }}>
            <SignUpForm
              initialEmail={emailFlow.signupEmail ?? undefined}
              onBack={() => {
                emailFlow.clearSignupEmail()
                emailFlow.resetToEmailStep()
                goTo('phone', -1)
              }}
              onPhone={(phoneE164) => {
                const matched =
                  COUNTRIES.reduce<Country | null>((best, c) => {
                    if (phoneE164.startsWith(c.dial)) {
                      if (!best || c.dial.length > best.dial.length) return c
                    }
                    return best
                  }, null) ?? COUNTRIES[0]
                setCountry(matched)
                setLocalNumber(phoneE164.slice(matched.dial.length))
                setMainTab('phone')
                goTo('phone', -1)
              }}
            />
          </View>
        </GradientBackground>
      </KeyboardAvoidingView>
    )
  }

  // ── Main page (phone + email inline) ─────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <GradientBackground style={{ flex: 1, justifyContent: 'space-between' }}>
        {logoNode}

        {/* Form — sits at the bottom */}
        <MotiView
          from={{ opacity: 0, translateX: direction.current * 40 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260, mass: 0.9 }}
          style={formWrapStyle}
        >
          {/* Header */}
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <View style={{ gap: 2 }}>
              <Text
                style={{
                  color: Colors.$textDefault,
                  fontSize: 24,
                  lineHeight: 26,
                  fontWeight: 'bold',
                }}
              >
                {isNewUser && phoneOtpSent
                  ? "Looks like you're new here"
                  : hasEverSignedIn
                    ? 'Welcome back,'
                    : 'Welcome to CardMania'}
              </Text>
              <Text style={{ color: Colors.$textNeutral, fontSize: 13 }}>
                {isNewUser && phoneOtpSent
                  ? `A new account will be created for ${e164}.`
                  : hasEverSignedIn
                    ? 'Sign in to continue.'
                    : 'Enter your preferred sign-in method.'}
              </Text>
            </View>
          </View>

          {/* Pill toggle */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: 20,
              padding: 3,
              alignSelf: 'flex-start',
            }}
          >
            {(['phone', 'email'] as const).map((tab) => {
              const active = mainTab === tab
              const color = active ? '#000' : 'rgba(255,255,255,0.6)'
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => {
                    tabSwitchDir.current = tab === 'email' ? 1 : -1
                    setMainTab(tab)
                    setError(null)
                    setPhoneOtpSent(false)
                    setPhoneCode('')
                    emailFlow.resetToEmailStep()
                  }}
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
                  {tab === 'phone' ? (
                    <Phone size={12} color={color} />
                  ) : (
                    <AtSign size={12} color={color} />
                  )}
                  <Text style={{ color, fontWeight: '600', fontSize: 12 }}>
                    {tab === 'phone' ? 'Phone' : 'Email'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* ── Tab content (animates on tab switch) ── */}
          <MotiView
            key={mainTab}
            from={{ opacity: 0, translateX: tabSwitchDir.current * 30 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 270, mass: 0.9 }}
            style={{ width: '100%', gap: 8 }}
          >
            {mainTab === 'phone' && !phoneOtpSent && (
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
                  minHeight: 60,
                  width: '100%',
                }}
              />
            )}

            {mainTab === 'phone' && phoneOtpSent && (
              <MotiView
                from={{ opacity: 0, translateX: 20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 260, mass: 0.9 }}
                style={{ width: '100%', gap: 16, alignItems: 'center' }}
              >
                <View
                  style={{
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                    Code sent to <Text style={{ color: 'white', fontWeight: '600' }}>{e164}</Text>
                  </Text>
                  <TouchableOpacity onPress={handleResetPhoneOtp}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Change</Text>
                  </TouchableOpacity>
                </View>
                <OtpInput
                  value={phoneCode}
                  onChange={setPhoneCode}
                  onComplete={handleVerifyPhoneOtp}
                />
                <TouchableOpacity
                  onPress={handleResendPhoneOtp}
                  disabled={resendCooldown > 0}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <RefreshCw
                    size={14}
                    color={resendCooldown > 0 ? 'rgba(255,255,255,0.3)' : 'white'}
                  />
                  <Text
                    style={{
                      color: resendCooldown > 0 ? 'rgba(255,255,255,0.3)' : 'white',
                      fontSize: 13,
                    }}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </MotiView>
            )}

            {mainTab === 'email' && (
              <Animated.View style={[{ width: '100%', gap: 8 }, shakeStyle]}>
                <TextField
                  leadingAccessory={
                    <User size={20} onPress={handleAnonSignIn} color={Colors.$textPrimary} />
                  }
                  placeholder="Email"
                  value={emailFlow.email}
                  onChangeText={(t) => {
                    emailFlow.setEmail(t)
                    if (emailFlow.error) emailFlow.setError(null)
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  showClearButton
                  floatingPlaceholder
                  returnKeyType={emailFlow.emailStep === 'password' ? 'next' : 'done'}
                  onSubmitEditing={() => {
                    if (emailFlow.emailStep === 'password') {
                      passwordFieldRef.current?.focus()
                    } else {
                      emailFlow.handleContinue()
                    }
                  }}
                  accentColor={emailFlow.error ? Colors.$textDanger : undefined}
                  containerStyle={{
                    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                  }}
                />
                {emailFlow.emailStep === 'password' && (
                  <MotiView
                    from={{ opacity: 0, translateY: -8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 260, mass: 0.9 }}
                    style={{ gap: 8 }}
                  >
                    <TouchableOpacity
                      onPress={emailFlow.resetToEmailStep}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                        ← Change email
                      </Text>
                    </TouchableOpacity>
                    <TextField
                      ref={passwordFieldRef}
                      leadingAccessory={<Lock size={20} color={Colors.$textPrimary} />}
                      trailingAccessory={
                        <TouchableOpacity
                          onPress={() => emailFlow.setShowPassword(!emailFlow.showPassword)}
                          accessibilityLabel={
                            emailFlow.showPassword ? 'Hide password' : 'Show password'
                          }
                          style={{
                            alignContent: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 4,
                          }}
                        >
                          {emailFlow.showPassword ? (
                            <EyeOff size={20} color={Colors.$textPrimary} />
                          ) : (
                            <Eye size={20} color={Colors.$textPrimary} />
                          )}
                        </TouchableOpacity>
                      }
                      placeholder="Password"
                      value={emailFlow.password}
                      onChangeText={(t) => {
                        emailFlow.setPassword(t)
                        if (emailFlow.error) emailFlow.setError(null)
                      }}
                      secureTextEntry={!emailFlow.showPassword}
                      autoCapitalize="none"
                      floatingPlaceholder
                      returnKeyType="done"
                      onSubmitEditing={handleSignIn}
                      accentColor={emailFlow.error ? Colors.$textDanger : undefined}
                      containerStyle={{
                        backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                        minHeight: 60,
                      }}
                    />
                  </MotiView>
                )}
              </Animated.View>
            )}
          </MotiView>

          {/* Error + CTA */}
          <View style={{ alignItems: 'center', width: '100%' }}>
            <MotiView
              animate={{
                opacity: (mainTab === 'email' ? emailFlow.error : error) ? 1 : 0,
                translateY: (mainTab === 'email' ? emailFlow.error : error) ? 0 : -6,
                minHeight: (mainTab === 'email' ? emailFlow.error : error) ? 20 : 0,
              }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ width: '100%', justifyContent: 'center' }}
              pointerEvents="none"
            >
              <Text className="text-red-400 text-sm text-center w-full px-4">
                {mainTab === 'email' ? (emailFlow.error ?? '') : (error ?? '')}
              </Text>
            </MotiView>
            {mainTab === 'phone' && !phoneOtpSent && (
              <BaseButton onPress={handleSendCode} disabled={loading || !localNumber.trim()}>
                {loading ? 'Sending code…' : 'Send code'}
              </BaseButton>
            )}
            {mainTab === 'phone' && phoneOtpSent && (
              <BaseButton
                onPress={() => phoneCode.length === 6 && handleVerifyPhoneOtp(phoneCode)}
                disabled={loading || phoneCode.length < 6}
              >
                {loading ? 'Verifying…' : 'Verify'}
              </BaseButton>
            )}
            {mainTab === 'email' && emailFlow.emailStep === 'email' && (
              <BaseButton
                onPress={() => {
                  if (!emailFlow.email.trim()) {
                    emailFlow.setError('Please enter your email.')
                    triggerShake()
                    return
                  }
                  emailFlow.handleContinue()
                }}
                disabled={emailFlow.loading}
              >
                {emailFlow.loading ? 'Checking…' : 'Continue'}
              </BaseButton>
            )}
            {mainTab === 'email' && emailFlow.emailStep === 'password' && (
              <BaseButton onPress={() => handleSignIn()} disabled={emailFlow.loading}>
                {emailFlow.loading ? 'Signing in…' : 'Sign in'}
              </BaseButton>
            )}
          </View>

          {/* Divider */}
          <View className="w-full flex flex-row items-center gap-6 justify-center">
            <Separator orientation="horizontal" className="flex-1 bg-white" />
            <Text className="text-white">or</Text>
            <Separator orientation="horizontal" className="flex-1 bg-white" />
          </View>

          <GoogleSignInButton />
          <FacebookSignInButton />
        </MotiView>
      </GradientBackground>
    </KeyboardAvoidingView>
  )
}
