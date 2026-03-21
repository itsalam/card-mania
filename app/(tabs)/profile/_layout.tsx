// app/(tabs)/_layout.tsx (or wherever your TabLayout lives)
import { Stack } from 'expo-router'
import React from 'react'
import { Platform } from 'react-native'

// Keep your haptics + background

// ➜ Lucide icons
// Install if needed:
//   yarn add lucide-react-native
//   npx expo install react-native-svg

export default function TabLayout() {
  return (
    <Stack initialRouteName="index">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{
          // Slide up from the bottom as a modal
          presentation: 'modal',
          animation: 'slide_from_right',
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="[shop-item]"
        options={{
          presentation: Platform.OS === 'android' ? 'transparentModal' : 'transparentModal',
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  )
}
