import { ToastProvider } from '@/components/Toast'
import ThemeProvider from '@/components/ui/theme'
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
const qc = new QueryClient()

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
                <ToastProvider>{children}</ToastProvider>
              </GestureHandlerRootView>
            </StoreProvider>
            {/* <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} /> */}
          </ThemeProvider>
        </SettingsProvider>
      </KeyboardProvider>
    </QueryClientProvider>
  )
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect
