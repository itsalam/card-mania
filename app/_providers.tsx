import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider'
import { useColorScheme } from '@/lib/hooks/useColorScheme'

import '@/components/nativewind-svg'
import '../global.css'

import { OverlayProvider } from '@/features/overlay/provider'
import { NAV_THEME } from '@/lib/constants'
import { supabase } from '@/lib/store/client'
import { StoreProvider } from '@/lib/store/provider'
import { AuthStatus, useUserStore } from '@/lib/store/useUserStore'
import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native'
import { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useRef } from 'react'
import { Platform } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
const qc = new QueryClient()

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
}
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const hasMounted = React.useRef(false)
  const { colorScheme, isDarkColorScheme } = useColorScheme()
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Roboto: require('../assets/fonts/Roboto-Regular.ttf'),
    BitcountGrid: require('../assets/fonts/BitcountGrid.ttf'),
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
      } = await supabase.auth.getSession()

      if (error) setStatus('error')
      await updateStatus(session)
    })()

    // 2) Subscribe to future auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
            <OverlayProvider>
              <StoreProvider>
                <GestureHandlerRootView>{children}</GestureHandlerRootView>
              </StoreProvider>
            </OverlayProvider>
            {/* <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} /> */}
          </ThemeProvider>
        </GluestackUIProvider>
      </KeyboardProvider>
    </QueryClientProvider>
  )
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect
