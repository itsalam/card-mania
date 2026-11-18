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

export type Role = 'owner' | 'editor' | 'ops'

export type Identity = { email: string; role: string }

type Tokens = { accessToken: string; refreshToken: string }

/** Result shape every backend function returns (see backend/admin/rpc.ts). */
export type FnResult = { ok: boolean; data?: unknown; code?: string; message?: string }

/** What a backend hook's trigger() returns. */
type Triggered = { result: Promise<unknown> }

type AuthContextValue = {
  status: AuthStatus
  identity: Identity | null
  accessToken: string | null
  /** Shown on the sign-in screen after an involuntary sign-out (expired session, failed check). */
  notice: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => void
  /**
   * Runs an admin call with the current access token. If the token has expired it refreshes
   * the session once and retries; if the refresh fails it signs out with a notice.
   */
  callAdmin: (call: (accessToken: string) => Triggered) => Promise<FnResult | undefined>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type SignInFnResult = {
  ok: boolean
  data?: { accessToken: string; refreshToken: string; expiresIn: number; email: string }
  message?: string
}

type RefreshFnResult = {
  ok: boolean
  data?: { accessToken: string; refreshToken: string; expiresIn: number }
  message?: string
}

const REFRESH_INTERVAL_MS = 50 * 60 * 1000
/** On returning to the tab, refresh if the last refresh is older than this. */
const STALE_AFTER_MS = 45 * 60 * 1000
const SESSION_EXPIRED = 'Your session expired. Sign in again.'

/** PostgREST's "JWT expired" (PGRST303 in current versions, PGRST301 in older ones). */
export function isTokenExpired(res: FnResult | undefined): boolean {
  if (!res || res.ok) return false
  return res.code === 'PGRST303' || res.code === 'PGRST301' || /jwt expired/i.test(res.message ?? '')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { trigger: triggerSignIn } = useSignIn()
  const { trigger: triggerRefresh } = useRefreshToken()
  const { trigger: triggerWhoami } = useWhoami()

  const [status, setStatus] = useState<AuthStatus>('signed-out')
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [tokens, setTokens] = useState<Tokens | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const tokensRef = useRef<Tokens | null>(null)
  const lastRefreshAtRef = useRef(0)
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null)

  const setSession = useCallback((next: Tokens | null) => {
    tokensRef.current = next
    lastRefreshAtRef.current = next ? Date.now() : 0
    setTokens(next)
  }, [])

  const endSession = useCallback(
    (message: string | null) => {
      setSession(null)
      setIdentity(null)
      setNotice(message)
      setStatus('signed-out')
    },
    [setSession],
  )

  const signOut = useCallback(() => endSession(null), [endSession])

  /** Refreshes the session; concurrent callers share one request. Returns the new access token. */
  const refreshSession = useCallback((): Promise<string | null> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current
    const run = (async () => {
      const current = tokensRef.current
      if (!current?.refreshToken) return null
      const res = (await triggerRefresh({ refreshToken: current.refreshToken }).result) as
        | RefreshFnResult
        | undefined
      if (res?.ok && res.data) {
        setSession({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken })
        return res.data.accessToken
      }
      endSession(SESSION_EXPIRED)
      return null
    })()
    refreshInFlightRef.current = run
    void run.finally(() => {
      refreshInFlightRef.current = null
    })
    return run
  }, [triggerRefresh, setSession, endSession])

  const callAdmin = useCallback(
    async (call: (accessToken: string) => Triggered): Promise<FnResult | undefined> => {
      const current = tokensRef.current
      if (!current) return undefined
      const first = (await call(current.accessToken).result) as FnResult | undefined
      if (!isTokenExpired(first)) return first
      const fresh = await refreshSession()
      if (!fresh) return first
      return (await call(fresh).result) as FnResult | undefined
    },
    [refreshSession],
  )

  const resolveIdentity = useCallback(
    async (accessToken: string, fallbackEmail: string) => {
      setStatus('checking')
      const res = (await triggerWhoami({ accessToken }).result) as FnResult | undefined
      if (res?.ok) {
        const raw = Array.isArray(res.data) ? res.data[0] : res.data
        const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
        setIdentity({
          email: String(record['email'] ?? fallbackEmail),
          role: String(record['role'] ?? 'unknown'),
        })
        setNotice(null)
        setStatus('authorized')
      } else if (res?.code === '42501') {
        // Signed in fine, but not in admin.members.
        setIdentity({ email: fallbackEmail, role: 'none' })
        setStatus('unauthorized')
      } else {
        // Anything else (network, expired token, schema not exposed…) is not a membership answer.
        endSession(res?.message ? `Couldn't check admin access: ${res.message}` : "Couldn't check admin access.")
      }
    },
    [triggerWhoami, endSession],
  )

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      setStatus('signing-in')
      setNotice(null)
      const res = (await triggerSignIn({ email, password }).result) as SignInFnResult | undefined
      if (!res?.ok || !res.data) {
        endSession(null)
        return res?.message ?? 'Sign-in failed.'
      }
      setSession({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken })
      await resolveIdentity(res.data.accessToken, res.data.email)
      return null
    },
    [triggerSignIn, resolveIdentity, setSession, endSession],
  )

  // Refresh on a timer while signed in, and when the tab comes back after a long gap
  // (background tabs and sleeping laptops throttle or skip timers).
  useEffect(() => {
    if (status !== 'authorized') return
    const interval = setInterval(() => void refreshSession(), REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefreshAtRef.current > STALE_AFTER_MS) void refreshSession()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status, refreshSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      identity,
      accessToken: tokens?.accessToken ?? null,
      notice,
      signIn,
      signOut,
      callAdmin,
    }),
    [status, identity, tokens, notice, signIn, signOut, callAdmin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Which pages each role can open, in nav order. Owner passes every check in the database too. */
export type PageKey = 'promos' | 'results' | 'home-sections' | 'members' | 'audit-log'

export const PAGES_BY_ROLE: Record<string, readonly PageKey[]> = {
  owner: ['promos', 'results', 'home-sections', 'members', 'audit-log'],
  editor: ['promos', 'results', 'home-sections'],
  ops: ['results', 'audit-log'],
}

export function allowedPages(role: string | undefined): readonly PageKey[] {
  return (role && PAGES_BY_ROLE[role]) || []
}
