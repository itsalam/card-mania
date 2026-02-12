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
import { ReactNode } from 'react'

import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { NAV_THEME } from '@/lib/constants'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as RNThemeProvider,
  Theme,
} from '@react-navigation/native'
import React, { useEffect } from 'react'
import { Platform } from 'react-native'
import { Colors } from 'react-native-ui-lib'

Colors.supportDarkMode()
Colors.loadSchemes({
  light: {
    $backgroundPrimaryHeavy: Colors.blue30,
    $backgroundPrimaryMedium: Colors.blue50,
    $backgroundPrimaryLight: Colors.blue80,
    $textPrimary: Colors.blue30,
    $iconPrimary: Colors.blue30,
    $iconPrimaryLight: Colors.blue30,
    $outlinePrimary: Colors.blue30,
  },
  dark: {
    $backgroundPrimaryHeavy: Colors.blue30,
    $backgroundPrimaryMedium: Colors.blue5,
    $backgroundPrimaryLight: Colors.blue1,
    $textPrimary: Colors.blue50,
    $iconPrimary: Colors.blue50,
    $iconPrimaryLight: Colors.blue30,
    $outlinePrimary: Colors.blue50,
  },
})

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
}
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
}

const ThemeContext = React.createContext<Theme | null>(null)

const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false)
  const hasMounted = React.useRef(false)

  const colorScheme = useEffectiveColorScheme()

  // Apply scheme when preference changes
  useEffect(() => {
    Colors.setScheme(colorScheme)
  }, [colorScheme])

  const [loaded] = useFonts({
    SpaceMono: require('@/assets/fonts/SpaceMono-Regular.ttf'),
    Roboto: require('@/assets/fonts/Roboto-Regular.ttf'),
    BitcountGrid: require('@/assets/fonts/BitcountGrid.ttf'),
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
    <RNThemeProvider value={colorScheme === 'dark' ? DARK_THEME : LIGHT_THEME}>
      {children}
    </RNThemeProvider>
  )
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

export default ThemeProvider
