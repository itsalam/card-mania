/**
 * Web-only root layout.
 *
 * Expo Router automatically picks this file over `_layout.tsx` on the web
 * platform because of the `.web.tsx` extension.
 *
 * Intentional differences from the native layout:
 *  - No `expo-splash-screen`  (web has no splash)
 *  - No Sentry native SDK    (use @sentry/react for web if needed later)
 *  - No `expo-constants` navigation integration
 *  - No `PortalHost`         (rn-primitives portal not needed on web)
 */
import '@/components/icons'
import '@expo/metro-runtime'
import '../global.css'

import { WebOnboardingGate } from '@/features/web/WebOnboardingGate'
import { WebRouteGuard } from '@/features/web/WebRouteGuard'
import { Stack } from 'expo-router/stack'
import React from 'react'
import WebProviders from './_providers.web'

export { ErrorBoundary } from 'expo-router'

export default function WebRootLayout() {
  return (
    <WebProviders>
      <WebRouteGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
          }}
        >
          {/* Public web routes — no auth gate */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="[username]" options={{ headerShown: false }} />
          <Stack.Screen name="storefront/[username]" options={{ headerShown: false }} />
          <Stack.Screen name="cards/[card]" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="policy" options={{ headerShown: false }} />
          <Stack.Screen name="terms" options={{ headerShown: false }} />
          {/* Authenticated web routes — see lib/auth/protectedRoutes.ts */}
          <Stack.Screen name="offers" options={{ headerShown: false }} />
          <Stack.Screen name="cart" options={{ headerShown: false }} />
          <Stack.Screen name="transactions" options={{ headerShown: false }} />
          <Stack.Screen name="transactions/[offerId]" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </WebRouteGuard>
      {/* Onboarding wizard + post-setup tour — rendered above the page stack */}
      <WebOnboardingGate />
    </WebProviders>
  )
}
