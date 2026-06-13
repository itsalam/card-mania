import { useUserStore } from '@/lib/store/useUserStore'
import { useState } from 'react'

export type EmailAuthStep = 'email' | 'password'

function friendlySignInError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('email not confirmed')) return 'Please confirm your email before signing in.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Network error. Please check your connection.'
  return message
}

function isCredentialsError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('invalid login') ||
    m.includes('invalid credentials') ||
    m.includes('wrong password') ||
    m.includes('user not found')
  )
}

export type EmailAuthFlow = {
  email: string
  setEmail: (v: string) => void
  emailStep: EmailAuthStep
  password: string
  setPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  loading: boolean
  error: string | null
  setError: (e: string | null) => void
  /** Non-null when we detect the email is not registered — signals parent to open signup */
  signupEmail: string | null
  clearSignupEmail: () => void
  /** Email step → check existence → advance to password OR set signupEmail */
  handleContinue: () => Promise<void>
  /** Password step → attempt sign in → on credentials error, set signupEmail */
  handleSignIn: (onSuccess?: () => void) => Promise<void>
  resetToEmailStep: () => void
}

export function useEmailAuthFlow(): EmailAuthFlow {
  const { signIn, checkEmailRegistered } = useUserStore()

  const [email, setEmail] = useState('')
  const [emailStep, setEmailStep] = useState<EmailAuthStep>('email')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupEmail, setSignupEmail] = useState<string | null>(null)

  const handleContinue = async () => {
    setError(null)
    if (!email.trim()) {
      setError('Please enter your email.')
      return
    }
    setLoading(true)
    try {
      const exists = await checkEmailRegistered(email.trim())
      if (exists) {
        setEmailStep('password')
      } else {
        setSignupEmail(email.trim())
      }
    } catch {
      // RPC unavailable — fall through to password step so sign-in can still work
      setEmailStep('password')
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (onSuccess?: () => void) => {
    setError(null)
    if (!password) {
      setError('Please enter your password.')
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      onSuccess?.()
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (isCredentialsError(msg)) {
        setSignupEmail(email.trim())
      } else {
        setError(friendlySignInError(msg || 'Sign in failed.'))
      }
    } finally {
      setLoading(false)
    }
  }

  const resetToEmailStep = () => {
    setEmailStep('email')
    setPassword('')
    setError(null)
  }

  return {
    email,
    setEmail,
    emailStep,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loading,
    error,
    setError,
    signupEmail,
    clearSignupEmail: () => setSignupEmail(null),
    handleContinue,
    handleSignIn,
    resetToEmailStep,
  }
}
