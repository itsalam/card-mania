import { useUserStore } from '@/lib/store/useUserStore'
import { reportError } from '@/lib/utils/report-error'
import { useState } from 'react'
import { classifyAuthError } from './authErrors'

export type EmailAuthStep = 'email' | 'password'

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
  /** Password step → attempt sign in → on failure, set a friendly inline error */
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
    } catch (err) {
      // RPC unavailable — fall through to password step so sign-in can still work,
      // but log it since this lookup should never fail.
      reportError({ context: 'useEmailAuthFlow.checkEmailRegistered', error: err })
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
    } catch (err) {
      // The email was already confirmed registered in handleContinue, so a
      // credentials error here means a wrong password — keep the user on the
      // password step rather than bouncing them into sign-up.
      setError(classifyAuthError(err, 'useEmailAuthFlow.signIn').message)
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
