import { Button as AppButton } from '@/components/ui/button'
import { TextField } from '@/components/ui/input/base-input'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { OtpInput } from '@/features/splash/OtpInput'
import {
  COUNTRIES,
  Country,
  formatLocalNumber,
  isValidE164,
  toE164,
} from '@/features/splash/phoneUtils'
import { SignUpForm } from '@/features/splash/SignUpForm'
import { useEmailAuthFlow } from '@/features/splash/useEmailAuthFlow'
import { useUserStore } from '@/lib/store/useUserStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AtSign, ChevronDown, Eye, EyeOff, Lock, Phone, RefreshCw, X } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, TextInput, TouchableOpacity, View } from 'react-native'
import { G, Path, Svg } from 'react-native-svg'
import { Colors } from 'react-native-ui-lib'

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

// Minimal country prefix picker for web (avoids MaskedView dependency)
function WebCountryPicker({
  selected,
  onSelect,
}: {
  selected: Country
  onSelect: (c: Country) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = COUNTRIES.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    )
  })

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingRight: 4,
        }}
        accessibilityLabel="Select country code"
      >
        <Text style={{ fontSize: 16 }}>{selected.flag}</Text>
        <Text style={{ color: Colors.$textDefault, fontSize: 14, fontWeight: '600' }}>
          {selected.dial}
        </Text>
        <ChevronDown size={14} color={Colors.$textNeutral} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 340,
              maxHeight: 400,
              backgroundColor: Colors.$backgroundDefault,
              borderRadius: 16,
              overflow: 'visible',
              borderWidth: 1,
              borderColor: Colors.$outlineDefault,
            }}
          >
            {/* Search */}
            <View
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderColor: Colors.$outlineDefault,
              }}
            >
              <TextInput
                placeholder="Search country…"
                placeholderTextColor={Colors.$textNeutral}
                value={query}
                onChangeText={setQuery}
                autoFocus
                style={[
                  {
                    height: 40,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.6),
                    color: Colors.$textDefault,
                    fontSize: 14,
                    borderWidth: 1,
                    borderColor: Colors.$outlineDefault,
                  },
                  { outline: 'none' } as any,
                ]}
              />
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {filtered.map((c) => (
                <TouchableOpacity
                  key={`${c.code}-${c.dial}`}
                  onPress={() => {
                    onSelect(c)
                    setQuery('')
                    setOpen(false)
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor:
                      c.code === selected.code
                        ? Colors.rgba(Colors.$backgroundElevated, 0.5)
                        : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 20, width: 28 }}>{c.flag}</Text>
                  <Text style={{ color: Colors.$textDefault, flex: 1 }}>{c.name}</Text>
                  <Text style={{ color: Colors.$textNeutral, fontSize: 13 }}>{c.dial}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

type Props = {
  onClose: () => void
}

export function AuthModal({ onClose }: Props) {
  const { signInWithPhone, verifyPhoneOtp } = useUserStore()
  const [view, setView] = useState<'main' | 'signup'>('main')

  // Tab
  const [mainTab, setMainTab] = useState<'phone' | 'email'>('phone')

  // Email auth — shared hook
  const emailFlow = useEmailAuthFlow()

  // Phone state
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const [localNumber, setLocalNumber] = useState('')
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneCode, setPhoneCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Shared
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasEverSignedIn, setHasEverSignedIn] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('cardmania:hasEverSignedIn').then((v) => {
      if (v) setHasEverSignedIn(true)
    })
  }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((n) => n - 1), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  // When the email flow detects a new user, open the signup view
  useEffect(() => {
    if (emailFlow.signupEmail) setView('signup')
  }, [emailFlow.signupEmail])

  const maxDigits = country.format.split('').filter((c) => c === 'X').length
  const e164 = toE164(country.dial, localNumber)

  const handleSendCode = async () => {
    setError(null)
    if (!isValidE164(e164)) {
      setError('Please enter a valid phone number.')
      return
    }
    setLoading(true)
    try {
      await signInWithPhone(e164, false)
      setResendCooldown(60)
      setPhoneOtpSent(true)
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (isBlockingPhoneError(msg)) {
        setError(friendlyPhoneError(msg || 'Failed to send code. Please try again.'))
      } else {
        // Phone not registered — go to email signup with context
        setMainTab('email')
        setError('No account found for that number. Try email sign-up.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (token: string) => {
    setError(null)
    setLoading(true)
    try {
      await verifyPhoneOtp(e164, token)
      onClose()
    } catch (err: any) {
      setPhoneCode('')
      setError(friendlyOtpError(err?.message ?? 'Verification failed.'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      await signInWithPhone(e164, false)
      setResendCooldown(60)
      setPhoneCode('')
      setError(null)
    } catch (err: any) {
      setError(friendlyPhoneError(err?.message ?? 'Could not resend code.'))
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
        {/* Close */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <X size={20} color={Colors.$textNeutral} />
          </Pressable>
        </View>

        {view === 'main' ? (
          <MotiView
            from={{ opacity: 0, translateX: -16 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 180 }}
            style={{ gap: 16 }}
          >
            {/* Header */}
            <View style={{ gap: 2 }}>
              <Text
                style={{
                  color: Colors.$textDefault,
                  fontSize: 24,
                  lineHeight: 26,
                  fontWeight: 'bold',
                }}
              >
                {hasEverSignedIn ? 'Welcome back,' : 'Welcome to CardMania'}
              </Text>
              <Text style={{ color: Colors.$textNeutral, fontSize: 13 }}>
                {hasEverSignedIn ? 'Sign in to continue.' : 'Enter your preferred sign-in method.'}
              </Text>
            </View>

            {/* Pill toggle */}
            <View
              style={{
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.6),
                borderRadius: 20,
                padding: 3,
                alignSelf: 'flex-start',
                borderWidth: 1,
                borderColor: Colors.$outlineDefault,
              }}
            >
              <View style={{ flexDirection: 'row', position: 'relative' }}>
                {/* Sliding active pill */}
                <View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: '50%',
                      backgroundColor: Colors.$backgroundDefault,
                      borderRadius: 17,
                    },
                    {
                      transform: `translateX(${mainTab === 'email' ? '100%' : '0%'})`,
                      transition: 'transform 220ms cubic-bezier(0.4,0,0.2,1)',
                    } as any,
                  ]}
                />
                {(['phone', 'email'] as const).map((tab) => {
                  const active = mainTab === tab
                  return (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => {
                        setMainTab(tab)
                        setError(null)
                        setPhoneOtpSent(false)
                        setPhoneCode('')
                        emailFlow.resetToEmailStep()
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        paddingVertical: 5,
                        paddingHorizontal: 14,
                        borderRadius: 17,
                        flex: 1,
                        zIndex: 1,
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      {tab === 'phone' ? (
                        <Phone
                          size={12}
                          color={active ? Colors.$textPrimary : Colors.$textNeutral}
                        />
                      ) : (
                        <AtSign
                          size={12}
                          color={active ? Colors.$textPrimary : Colors.$textNeutral}
                        />
                      )}
                      <Text
                        style={[
                          { fontWeight: '600', fontSize: 12 },
                          {
                            color: active ? Colors.$textDefault : Colors.$textNeutral,
                            transition: 'color 220ms',
                          } as any,
                        ]}
                      >
                        {tab === 'phone' ? 'Phone' : 'Email'}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* Tab content — all sections absolutely stacked; active section shown via
                zIndex + opacity. Container height snaps instantly (no transition) to
                avoid any competing height animations causing modal jitter. */}
            <View
              style={[
                { position: 'relative', overflow: 'visible' },
                {
                  height:
                    mainTab === 'phone'
                      ? phoneOtpSent
                        ? 220
                        : 76
                      : emailFlow.emailStep === 'password'
                        ? 96
                        : 76,
                } as any,
              ]}
            >
              {/* ── Phone: number input ── */}
              <View
                pointerEvents={mainTab === 'phone' && !phoneOtpSent ? 'auto' : 'none'}
                style={[
                  { position: 'absolute', top: 0, left: 0, right: 0 },
                  {
                    zIndex: mainTab === 'phone' && !phoneOtpSent ? 1 : 0,
                    opacity: mainTab === 'phone' && !phoneOtpSent ? 1 : 0,
                    transform: `translateX(${mainTab === 'phone' && !phoneOtpSent ? 0 : -32}px)`,
                    transition: 'opacity 220ms ease, transform 240ms cubic-bezier(0.4,0,0.2,1)',
                  } as any,
                ]}
              >
                <TextField
                  leadingAccessory={
                    <WebCountryPicker
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
              </View>

              {/* ── Phone: OTP entry ── */}
              <View
                pointerEvents={mainTab === 'phone' && phoneOtpSent ? 'auto' : 'none'}
                style={[
                  { position: 'absolute', top: 0, left: 0, right: 0 },
                  {
                    zIndex: mainTab === 'phone' && phoneOtpSent ? 1 : 0,
                    opacity: mainTab === 'phone' && phoneOtpSent ? 1 : 0,
                    transform: `translateX(${mainTab === 'phone' && phoneOtpSent ? 0 : 32}px)`,
                    transition: 'opacity 220ms ease, transform 240ms cubic-bezier(0.4,0,0.2,1)',
                  } as any,
                ]}
              >
                <View style={{ gap: 12, alignItems: 'center', paddingBottom: 4 }}>
                  <View
                    style={{
                      width: '100%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: Colors.$textNeutral, fontSize: 13 }}>
                      Code sent to{' '}
                      <Text style={{ color: Colors.$textDefault, fontWeight: '600' }}>{e164}</Text>
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setPhoneOtpSent(false)
                        setPhoneCode('')
                        setError(null)
                      }}
                    >
                      <Text style={{ color: Colors.$textNeutral, fontSize: 13 }}>Change</Text>
                    </TouchableOpacity>
                  </View>
                  <OtpInput
                    value={phoneCode}
                    onChange={setPhoneCode}
                    onComplete={handleVerifyOtp}
                  />
                  <TouchableOpacity
                    onPress={handleResend}
                    disabled={resendCooldown > 0}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <RefreshCw
                      size={13}
                      color={resendCooldown > 0 ? Colors.$textDisabled : Colors.$textNeutral}
                    />
                    <Text
                      style={{
                        color: resendCooldown > 0 ? Colors.$textDisabled : Colors.$textNeutral,
                        fontSize: 13,
                      }}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Email: step 1 — email input ── */}
              <View
                pointerEvents={
                  mainTab === 'email' && emailFlow.emailStep === 'email' ? 'auto' : 'none'
                }
                style={[
                  { position: 'absolute', top: 0, left: 0, right: 0 },
                  {
                    zIndex: mainTab === 'email' && emailFlow.emailStep === 'email' ? 1 : 0,
                    opacity: mainTab === 'email' && emailFlow.emailStep === 'email' ? 1 : 0,
                    transform: `translateX(${
                      mainTab === 'email' && emailFlow.emailStep === 'email'
                        ? 0
                        : mainTab === 'email'
                          ? -32
                          : 32
                    }px)`,
                    transition: 'opacity 220ms ease, transform 240ms cubic-bezier(0.4,0,0.2,1)',
                  } as any,
                ]}
              >
                <TextField
                  leadingAccessory={<AtSign size={20} color={Colors.$textPrimary} />}
                  placeholder="Email"
                  value={emailFlow.email}
                  onChangeText={(t) => {
                    emailFlow.setEmail(t)
                    if (emailFlow.error) emailFlow.setError(null)
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  floatingPlaceholder
                  returnKeyType="done"
                  onSubmitEditing={emailFlow.handleContinue}
                  accentColor={emailFlow.error ? Colors.$textDanger : undefined}
                  containerStyle={{
                    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                    minHeight: 60,
                    width: '100%',
                  }}
                />
              </View>

              {/* ── Email: step 2 — password input ── */}
              <View
                pointerEvents={
                  mainTab === 'email' && emailFlow.emailStep === 'password' ? 'auto' : 'none'
                }
                style={[
                  { position: 'absolute', top: 0, left: 0, right: 0 },
                  {
                    zIndex: mainTab === 'email' && emailFlow.emailStep === 'password' ? 1 : 0,
                    opacity: mainTab === 'email' && emailFlow.emailStep === 'password' ? 1 : 0,
                    transform: `translateX(${mainTab === 'email' && emailFlow.emailStep === 'password' ? 0 : 32}px)`,
                    transition: 'opacity 220ms ease, transform 240ms cubic-bezier(0.4,0,0.2,1)',
                  } as any,
                ]}
              >
                <View style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: Colors.$textNeutral, fontSize: 13 }}>
                      Signing in as{' '}
                      <Text style={{ color: Colors.$textDefault, fontWeight: '600' }}>
                        {emailFlow.email}
                      </Text>
                    </Text>
                    <TouchableOpacity onPress={emailFlow.resetToEmailStep}>
                      <Text style={{ color: Colors.$textNeutral, fontSize: 13 }}>Change</Text>
                    </TouchableOpacity>
                  </View>
                  <TextField
                    leadingAccessory={<Lock size={20} color={Colors.$textPrimary} />}
                    trailingAccessory={
                      <TouchableOpacity
                        onPress={() => emailFlow.setShowPassword(!emailFlow.showPassword)}
                        accessibilityLabel={
                          emailFlow.showPassword ? 'Hide password' : 'Show password'
                        }
                        style={{ paddingHorizontal: 4 }}
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
                    onSubmitEditing={() => emailFlow.handleSignIn(onClose)}
                    accentColor={emailFlow.error ? Colors.$textDanger : undefined}
                    containerStyle={{
                      backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
                      minHeight: 60,
                      width: '100%',
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Error */}
            <View
              style={[
                { overflow: 'visible' },
                {
                  maxHeight: (mainTab === 'email' ? emailFlow.error : error) ? 40 : 0,
                  opacity: (mainTab === 'email' ? emailFlow.error : error) ? 1 : 0,
                  transition: 'max-height 200ms ease, opacity 180ms ease',
                } as any,
              ]}
            >
              <Text style={{ color: Colors.$textDanger, fontSize: 13, textAlign: 'center' }}>
                {mainTab === 'email' ? (emailFlow.error ?? '') : (error ?? '')}
              </Text>
            </View>

            {/* CTA — single slot, label swaps based on state */}
            <AppButton
              variant="primary"
              size="lg"
              onPress={
                mainTab === 'email'
                  ? emailFlow.emailStep === 'email'
                    ? emailFlow.handleContinue
                    : () => emailFlow.handleSignIn(onClose)
                  : phoneOtpSent
                    ? () => phoneCode.length === 6 && handleVerifyOtp(phoneCode)
                    : handleSendCode
              }
              disabled={
                emailFlow.loading ||
                loading ||
                (mainTab === 'phone' && !phoneOtpSent && !localNumber.trim()) ||
                (mainTab === 'phone' && phoneOtpSent && phoneCode.length < 6)
              }
              style={{ width: '100%' }}
            >
              {(mainTab === 'email' ? emailFlow.loading : loading)
                ? mainTab === 'email'
                  ? emailFlow.emailStep === 'email'
                    ? 'Checking…'
                    : 'Signing in…'
                  : phoneOtpSent
                    ? 'Verifying…'
                    : 'Sending code…'
                : mainTab === 'email'
                  ? emailFlow.emailStep === 'email'
                    ? 'Continue'
                    : 'Sign in'
                  : phoneOtpSent
                    ? 'Verify'
                    : 'Send code'}
            </AppButton>

            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 24 }}>
              <Separator orientation="horizontal" className="flex-1 bg-white" />
              <Text style={{ color: Colors.$textNeutral }}>or</Text>
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
        ) : (
          <MotiView
            from={{ opacity: 0, translateX: 16 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 180 }}
          >
            <SignUpForm
              onBack={() => {
                emailFlow.clearSignupEmail()
                emailFlow.resetToEmailStep()
                setView('main')
              }}
              onSuccess={onClose}
              initialEmail={emailFlow.signupEmail ?? undefined}
            />
          </MotiView>
        )}
      </Pressable>
    </Pressable>
  )
}
