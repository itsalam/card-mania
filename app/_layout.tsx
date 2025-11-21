import { Stack } from 'expo-router/stack'
import * as SplashScreen from 'expo-splash-screen'

import "@/components/icons"
import '@/components/nativewind-svg'
import '../global.css'
require('react-native-ui-lib/config').setConfig({appScheme: 'default'});

import { PortalHost } from '@rn-primitives/portal'
import React from 'react'
import { Appearance, Platform } from 'react-native'
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import Providers from './_providers'

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router'

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
})

// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
})

SplashScreen.preventAutoHideAsync()

const colorScheme = Appearance.getColorScheme();

Colors.setScheme(colorScheme === 'dark' ? 'dark' : 'light');

export default function RootLayout() {
  return (
    <Providers>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 150,
          presentation: 'modal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen
          name="cards/[card]"
          options={{
            presentation: Platform.OS === 'android' ? 'transparentModal' : 'transparentModal',
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>

      <PortalHost />
    </Providers>
  )
}
