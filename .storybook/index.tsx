import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SplashScreen from 'expo-splash-screen'
import React, { useEffect } from 'react'
import { view } from './storybook.requires'

// ThemeProvider normally hides the splash screen, but it never mounts in
// Storybook mode. Hide it here so the Storybook UI is actually visible.
function StorybookWithSplash() {
  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  const UI = view.getStorybookUI({
    storage: {
      getItem: AsyncStorage.getItem,
      setItem: AsyncStorage.setItem,
    },
  })
  return <UI />
}

export default StorybookWithSplash
