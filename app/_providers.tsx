import {
  Montserrat_100Thin,
  Montserrat_100Thin_Italic,
  Montserrat_200ExtraLight,
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Montserrat_900Black,
} from '@expo-google-fonts/montserrat'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider'
import { useColorScheme } from '@/lib/hooks/useColorScheme'

import { ToastProvider } from '@/components/Toast'
import { NAV_THEME } from '@/lib/constants'
import { StoreProvider } from '@/lib/store/provider'
import { AuthStatus, useUserStore } from '@/lib/store/useUserStore'
import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native'
import { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Constants from 'expo-constants'
import React, { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { getSupabase } from '../lib/store/client'
const qc = new QueryClient()

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
}
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
}

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

  const hasMounted = React.useRef(false)
  const { isDarkColorScheme } = useColorScheme()
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Roboto: require('../assets/fonts/Roboto-Regular.ttf'),
    BitcountGrid: require('../assets/fonts/BitcountGrid.ttf'),
    Montserrat_100Thin: Montserrat_100Thin,
    Montserrat_200ExtraLight: Montserrat_200ExtraLight,
    Montserrat_300Light: Montserrat_300Light,
    Montserrat_400Regular: Montserrat_400Regular,
    Montserrat_500Medium: Montserrat_500Medium,
    Montserrat_600SemiBold: Montserrat_600SemiBold,
    Montserrat_700Bold: Montserrat_700Bold,
    Montserrat_800ExtraBold: Montserrat_800ExtraBold,
    Montserrat_900Black: Montserrat_900Black,
    Montserrat_100Thin_Italic: Montserrat_100Thin_Italic,
  })

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

  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false)

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return
    }

    if (Platform.OS === 'web') {
      // Adds the background color to the html element to prevent white background on overscroll.
      document.documentElement.classList.add('bg-background')
    }
    setIsColorSchemeLoaded(true)
    hasMounted.current = true
  }, [])

  if (!isColorSchemeLoaded) {
    return null
  }

  if (!loaded) {
    // Async font loading only occurs in development.
    return null
  } else {
    SplashScreen.hide()
  }

  return (
    <QueryClientProvider client={qc}>
      <KeyboardProvider>
        <GluestackUIProvider>
          <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
            <StoreProvider>
              <GestureHandlerRootView>
                <ToastProvider>{children}</ToastProvider>
              </GestureHandlerRootView>
            </StoreProvider>
            {/* <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} /> */}
          </ThemeProvider>
        </GluestackUIProvider>
      </KeyboardProvider>
    </QueryClientProvider>
  )
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect
