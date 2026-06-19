/**
 * Minimal provider tree for the web build.
 *
 * Deliberately excludes mobile-only dependencies:
 *  - react-native-keyboard-controller (KeyboardProvider)
 *  - react-native-gesture-handler     (GestureHandlerRootView)
 *  - OfferRealtimeProvider (mobile-only flow)
 *
 * OnboardingProvider is now included — it has no native deps and drives
 * the post-setup tour on web via WebOnboardingGate / OnboardingOverlay.web.
 */
import { ToastProvider } from '@/components/Toast'
import ThemeProvider from '@/components/ui/theme'
import { OnboardingProvider } from '@/features/onboarding'
import { SettingsProvider } from '@/features/settings'
import { localStorageLocalAdapter } from '@/features/settings/adapters/local-adapter.web'
import { webSystemAdapter } from '@/features/settings/adapters/system-adapter.web'
import { CartPanel } from '@/features/web/CartPanel'
import { StoreProvider } from '@/lib/store/provider'
import { AuthStatus, useUserStore } from '@/lib/store/useUserStore'
import { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useEffect } from 'react'
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
  useEffect(() => {
    const { setAuth, setStatus } = useUserStore.getState()

    const updateStatus = async (session: Session | null) => {
      await setAuth(session ?? null)
      setStatus(session ? AuthStatus.AUTHENTICATED : AuthStatus.IDLE)
    }

    // Subscribe before the initial getSession so no SIGNED_IN event is missed.
    // The callback is kept synchronous (no async/await) to avoid a deadlock:
    // _notifyAllSubscribers fires while the auth lock is held, so any awaited
    // Supabase call inside the callback would try to re-acquire the same lock.
    // setTimeout(0) defers work until after the lock is released — same pattern
    // as app/_providers.tsx.
    const { data: sub } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Supabase fires SIGNED_OUT whenever the user ID changes (e.g. anon → real user
        // during sign-in). Anonymous re-sign-in is handled explicitly by signOut() in
        // the store, not here, to avoid racing with the subsequent SIGNED_IN event.
        return
      }
      // Don't let a late anonymous SIGNED_IN overwrite an already-authenticated real user.
      if (session?.user?.is_anonymous) {
        const current = useUserStore.getState().user
        if (current && !current.is_anonymous) return
      }
      setTimeout(() => {
        updateStatus(session).catch(console.error)
      }, 0)
    })

    ;(async () => {
      setStatus('loading')
      let {
        data: { session },
        error,
      } = await getSupabase().auth.getSession()

      if (!session && !error) {
        // Auto-sign in anonymously so requests carry a JWT rather than just the anon key.
        // RLS restricts storefront reads to `authenticated` role — anon key alone is insufficient.
        // Session is persisted in localStorage — repeat visitors reuse the same anon session.
        const { data: anonData } = await getSupabase().auth.signInAnonymously()
        // Only use the anon session if a real user hasn't signed in concurrently
        // (signInAnonymously awaits the auth lock, so sign-in may have completed by now).
        const current = useUserStore.getState().user
        if ((!current || current.is_anonymous) && anonData.session) {
          session = anonData.session
        }
      }

      signalClientReady()
      if (error) setStatus('error')
      // Skip if a real user signed in while we were awaiting signInAnonymously().
      const current = useUserStore.getState().user
      if (!current || current.is_anonymous) {
        await updateStatus(session)
      }
    })()

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <QueryClientProvider client={qc}>
      <SettingsProvider
        localAdapter={localStorageLocalAdapter}
        systemAdapter={webSystemAdapter}
        remoteEnabled={false}
      >
        <ThemeProvider>
          <StoreProvider>
            <ToastProvider>
              <OnboardingProvider />
              {children}
              <CartPanel />
            </ToastProvider>
          </StoreProvider>
        </ThemeProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}
