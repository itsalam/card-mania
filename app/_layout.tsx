import { Stack } from 'expo-router/stack'
import * as SplashScreen from 'expo-splash-screen'

import '@/components/icons'
import '@/components/nativewind-svg'
import '../global.css'
require('react-native-ui-lib/config').setConfig({ appScheme: 'default' })

import { PortalHost } from '@rn-primitives/portal'
import * as Sentry from '@sentry/react-native'
import { isRunningInExpoGo } from 'expo'
import Constants from 'expo-constants'
import { useNavigationContainerRef } from 'expo-router'
import React from 'react'
import { Platform } from 'react-native'
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated'
import Providers from './_providers'

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
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>

      <PortalHost />
    </Providers>
  )
})
