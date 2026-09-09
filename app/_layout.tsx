import { Stack } from 'expo-router/stack'
import * as SplashScreen from 'expo-splash-screen'

import '@/components/icons'
import '@/components/nativewind-svg'
import '../global.css'

import { CardPlaceholderPrefetch } from '@/components/tcg-card/placeholders'
import { OnboardingOverlay } from '@/features/onboarding'
import { PortalHost } from '@rn-primitives/portal'
import * as Sentry from '@sentry/react-native'
import { isRunningInExpoGo } from 'expo'
import Constants from 'expo-constants'
import { useNavigationContainerRef } from 'expo-router'
import React from 'react'
import { Platform } from 'react-native'
import 'react-native-get-random-values'
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated'
import Providers from './_providers'
require('react-native-ui-lib/config').setConfig({ appScheme: 'default' })

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
})

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDSN,
  tracesSampleRate: Number(Constants.expoConfig?.extra?.sentrySampleRate) ?? 1.0,
  integrations: [navigationIntegration],
  enableNativeFramesTracking: !isRunningInExpoGo(),

  enabled: true, // <—— force enabled in dev
  // debug: true,
})

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
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

// When EXPO_PUBLIC_STORYBOOK=true, bypass the app and render the Storybook UI.
// The conditional require keeps the storybook bundle out of production.
if (process.env.EXPO_PUBLIC_STORYBOOK === 'true') {
  const StorybookUIRoot = require('../.storybook/index').default
  module.exports = { default: StorybookUIRoot }
}

export default Sentry.wrap(function RootLayout() {
  const ref = useNavigationContainerRef()
  React.useEffect(() => {
    if (ref) {
      navigationIntegration.registerNavigationContainer(ref)
    }
  }, [ref])

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
            // The footer's own DraggableFooter sheet uses a vertical pan (drag down to collapse,
            // drag up to expand). Without this, that same downward drag was ALSO being claimed by
            // the native stack's own swipe-to-dismiss gesture on this modal screen — dragging down
            // on the pinned bar or the sheet's thumb closed the whole screen instead of just
            // collapsing the footer. Disabling it here leaves dismissal to explicit UI (back
            // button, etc.) and gives the footer's pan gesture exclusive control of vertical drags.
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="cards/[card]/add-to-collection"
          options={{
            presentation: Platform.OS === 'android' ? 'transparentModal' : 'transparentModal',
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="cart"
          options={{
            presentation: 'transparentModal',
            headerShown: false,
            animation: 'none',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <PortalHost />
      <OnboardingOverlay />
      {/* Warms the generic card placeholder image into expo-image's cache once, at app load —
          see that component's own doc for why this beats an Image.prefetch call. */}
      <CardPlaceholderPrefetch />
    </Providers>
  )
})
