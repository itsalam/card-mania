import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';

import "@/components/nativewind-svg";
import '../global.css';

import { NAV_THEME } from '@/lib/constants';
import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClient } from '@tanstack/react-query';
import React from 'react';
import { Platform } from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import Providers from './_providers';
const qc = new QueryClient()

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
}
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
})

// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {

  return (
    <Providers>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 150,
          presentation: 'containedTransparentModal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="cards/[card]" options={{
          presentation: Platform.OS === "android"
            ? "containedTransparentModal"
            : "containedTransparentModal",
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "transparent" },
        }} />
        <Stack.Screen name="+not-found" />

      </Stack>

      <PortalHost />
    </Providers>
  )
}
