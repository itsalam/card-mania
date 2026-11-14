import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useRefreshToken, useSignIn } from '../hooks/backend/auth'
import { useWhoami } from '../hooks/backend/admin'

export type AuthStatus = 'signed-out' | 'signing-in' | 'checking' | 'authorized' | 'unauthorized'

export type Identity = { email: string; role: string }

type Tokens = { accessToken: string; refreshToken: string }

type AuthContextValue = {
  status: AuthStatus
  identity: Identity | null
  accessToken: string | null
  unauthorizedMessage: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

type SignInFnResult = {
  ok: boolean
  data?: { accessToken: string; refreshToken: string; expiresIn: number; email: string }
  message?: string
}

type WhoamiFnResult = {
  ok: boolean
  data?: unknown
  message?: string
}

type RefreshFnResult = {
  ok: boolean
  data?: { accessToken: string; refreshToken: string; expiresIn: number }
  message?: string
}

const REFRESH_INTERVAL_MS = 50 * 60 * 1000

export function AuthProvider({ children }: { children: ReactNode }) {
  const { trigger: triggerSignIn } = useSignIn()
  const { trigger: triggerRefresh } = useRefreshToken()
  const { trigger: triggerWhoami } = useWhoami()

  const [status, setStatus] = useState<AuthStatus>('signed-out')
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [tokens, setTokens] = useState<Tokens | null>(null)
  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null)
  const tokensRef = useRef<Tokens | null>(null)

  const setSession = useCallback((next: Tokens | null) => {
    tokensRef.current = next
    setTokens(next)
  }, [])

  const signOut = useCallback(() => {
    setSession(null)
    setIdentity(null)
    setUnauthorizedMessage(null)
    setStatus('signed-out')
  }, [setSession])

  const resolveIdentity = useCallback(
    async (accessToken: string, fallbackEmail: string) => {
      setStatus('checking')
      const res = (await triggerWhoami({ accessToken }).result) as WhoamiFnResult | undefined
      if (res?.ok) {
        const raw = Array.isArray(res.data) ? res.data[0] : res.data
        const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
        setIdentity({
          email: String(record['email'] ?? fallbackEmail),
          role: String(record['role'] ?? 'unknown'),
        })
        setUnauthorizedMessage(null)
        setStatus('authorized')
      } else {
        setIdentity(null)
        setUnauthorizedMessage(res?.message ?? null)
        setStatus('unauthorized')
      }
    },
    [triggerWhoami],
  )

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      setStatus('signing-in')
      const res = (await triggerSignIn({ email, password }).result) as SignInFnResult | undefined
      if (!res?.ok || !res.data) {
        setSession(null)
        setIdentity(null)
        setStatus('signed-out')
        return res?.message ?? 'Sign-in failed.'
      }
      setSession({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken })
      await resolveIdentity(res.data.accessToken, res.data.email)
      return null
    },
    [triggerSignIn, resolveIdentity, setSession],
  )

  // Refresh the session every 50 minutes while signed in.
  useEffect(() => {
    if (status !== 'authorized') return
    const interval = setInterval(async () => {
      const current = tokensRef.current
      if (!current?.refreshToken) return
      const res = (await triggerRefresh({ refreshToken: current.refreshToken }).result) as
        | RefreshFnResult
        | undefined
      if (res?.ok && res.data) {
        setSession({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken })
      } else {
        // Refresh failed: drop the session back to the sign-in screen.
        setSession(null)
        setIdentity(null)
        setUnauthorizedMessage(null)
        setStatus('signed-out')
      }
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status, triggerRefresh, setSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      identity,
      accessToken: tokens?.accessToken ?? null,
      unauthorizedMessage,
      signIn,
      signOut,
    }),
    [status, identity, tokens, unauthorizedMessage, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
