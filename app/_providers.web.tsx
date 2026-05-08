/**
 * Minimal provider tree for the web build.
 *
 * Deliberately excludes mobile-only dependencies:
 *  - react-native-keyboard-controller (KeyboardProvider)
 *  - react-native-gesture-handler     (GestureHandlerRootView)
 *  - OnboardingProvider / OfferRealtimeProvider (mobile-only flows)
 *
 * Everything needed for public storefront data fetching is included.
 */
import { ToastProvider } from '@/components/Toast'
import ThemeProvider from '@/components/ui/theme'
import { SettingsProvider } from '@/features/settings'
import { StoreProvider } from '@/lib/store/provider'
import { AuthStatus, useUserStore } from '@/lib/store/useUserStore'
import { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Constants from 'expo-constants'
import React, { useEffect, useRef } from 'react'
import { getSupabase, signalClientReady } from '../lib/store/client'

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5000),
    },
  },
})

export default function WebProviders({ children }: { children: React.ReactNode }) {
  const { setAuth, setStatus } = useUserStore.getState()
  const { status } = useUserStore()
  const subOnce = useRef(false)

  useEffect(() => {
    const updateStatus = async (session: Session | null) => {
      await setAuth(session ?? null)
      setStatus(session ? AuthStatus.AUTHENTICATED : AuthStatus.IDLE)
    }

    if (subOnce.current) return
    subOnce.current = true

    ;(async () => {
      setStatus('loading')
      const {
        data: { session },
        error,
      } = await getSupabase().auth.getSession()
      signalClientReady()
      if (error) setStatus('error')
      await updateStatus(session)
    })()

    const { data: sub } = getSupabase().auth.onAuthStateChange(async (_event, session) => {
      await updateStatus(session)
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [status])

  return (
    <QueryClientProvider client={qc}>
      <SettingsProvider
        localAdapter={undefined as any}
        systemAdapter={undefined as any}
        remoteEnabled={false}
      >
        <ThemeProvider>
          <StoreProvider>
            <ToastProvider>{children}</ToastProvider>
          </StoreProvider>
        </ThemeProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}
