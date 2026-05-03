import { getCachedPrefetchEnabled, prefetchSuggestions } from '@/client/price-charting'
import { ToastProvider } from '@/components/Toast'
import ThemeProvider from '@/components/ui/theme'
import { useOfferRealtime } from '@/features/offers/use-offer-realtime'
import { OnboardingProvider } from '@/features/onboarding'
import { SettingsProvider } from '@/features/settings'
import { asyncStorageLocalAdapter } from '@/features/settings/adapters/local-adapter'
import { reactNativeSystemAdapter } from '@/features/settings/adapters/system-adapter'
import { StoreProvider } from '@/lib/store/provider'
import { AuthStatus, useUserStore } from '@/lib/store/useUserStore'
import { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Constants from 'expo-constants'
import React, { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { getSupabase } from '../lib/store/client'
const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5000),
    },
  },
})

export function getEnvFingerprint() {
  return Constants.expoConfig?.extra?.supabaseUrl
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const envFingerprint = getEnvFingerprint()
  const prevEnv = useRef<string | null>(null)

  useEffect(() => {
    if (prevEnv.current && prevEnv.current !== envFingerprint) {
      qc.clear()
    }
    prevEnv.current = envFingerprint ?? null
  }, [envFingerprint])

  const { setAuth, setStatus } = useUserStore.getState()
  const { status } = useUserStore()
  const subOnce = useRef(false)

  useIsomorphicLayoutEffect(() => {
    const updateStatus = async (session: Session | null) => {
      await setAuth(session ?? null)
      setStatus(session ? AuthStatus.AUTHENTICATED : AuthStatus.IDLE)
    }
    if (subOnce.current) return // guard against dev double-mount
    subOnce.current = true

    // 1) Load current session on mount
    ;(async () => {
      setStatus('loading')
      const {
        data: { session },
        error,
      } = await getSupabase().auth.getSession()

      if (error) setStatus('error')
      await updateStatus(session)
    })()

    // 2) Subscribe to future auth changes
    const { data: sub } = getSupabase().auth.onAuthStateChange(async (_event, session) => {
      await updateStatus(session)
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [status])

  return (
    <QueryClientProvider client={qc}>
      <KeyboardProvider>
        <SettingsProvider
          localAdapter={asyncStorageLocalAdapter}
          systemAdapter={reactNativeSystemAdapter}
          remoteEnabled={false}
        >
          <ThemeProvider>
            <StoreProvider>
              <GestureHandlerRootView>
                <ToastProvider>
                  <OnboardingProvider />
                  <OfferRealtimeProvider />
                  <SearchPrefetchProvider />
                  {children}
                </ToastProvider>
              </GestureHandlerRootView>
            </StoreProvider>
            {/* <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} /> */}
          </ThemeProvider>
        </SettingsProvider>
      </KeyboardProvider>
    </QueryClientProvider>
  )
}

function OfferRealtimeProvider() {
  useOfferRealtime()
  return null
}

function SearchPrefetchProvider() {
  const { status } = useUserStore()
  const hasRun = useRef(false)

  useEffect(() => {
    // Guard on 'authenticated' specifically: 'idle' is the initial store value
    // (before getSession() even starts), so guarding on !== 'loading' still
    // fires on the first render before the Supabase client has loaded its
    // session from AsyncStorage. 'authenticated' is only set after setAuth +
    // loadProfile both complete, meaning PostgREST has already made a
    // successful query and the client is provably ready.
    if (status !== 'authenticated') return
    if (hasRun.current) return
    hasRun.current = true
    ;(async () => {
      try {
        // Bypass the Supabase JS client for this read — the client's token-refresh
        // lock can block PostgREST queries fired immediately after auth settles.
        // search_config has USING (true) RLS so the anon key is sufficient.
        const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string
        const supabaseKey = Constants.expoConfig?.extra?.supabaseKey as string
        const res = await fetch(
          `${supabaseUrl}/rest/v1/search_config?id=eq.1&select=suggestion_queries,suggestion_query_idx,prefetch_enabled`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        )
        if (!res.ok) {
          console.warn('[SearchPrefetch] search_config fetch failed:', res.status)
          return
        }
        const [data] = (await res.json()) as [
          | {
              suggestion_queries: string[]
              suggestion_query_idx: number
              prefetch_enabled: boolean
            }
          | undefined,
        ]
        if (!data) {
          console.warn('[SearchPrefetch] search_config row missing')
          return
        }

        const cachedEnabled = await getCachedPrefetchEnabled()
        console.log(
          '[SearchPrefetch] enabled — cached:',
          cachedEnabled,
          'db:',
          data.prefetch_enabled
        )
        if (!cachedEnabled && !data.prefetch_enabled) return

        const q =
          data.suggestion_queries[data.suggestion_query_idx] ?? data.suggestion_queries[0] ?? ''

        // Seed the search-bar placeholder immediately — useSuggestionQuery() reads
        // this same cache key, so the placeholder shows before the Supabase client
        // would have finished its own query.
        qc.setQueryData(['search-config-suggestion'], {
          suggestion_queries: data.suggestion_queries,
          suggestion_query_idx: data.suggestion_query_idx,
        })

        await prefetchSuggestions(qc, q)
        console.log('[SearchPrefetch] done')
      } catch (err: any) {
        console.warn('[SearchPrefetch] error:', err?.message ?? err)
      }
    })()
  }, [status])

  return null
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect
