// app/(tabs)/_layout.tsx (or wherever your TabLayout lives)
import { Tabs } from 'expo-router'
import React from 'react'
import { Platform } from 'react-native'

// Keep your haptics + background
import { HapticTab } from '@/components/HapticTab'
import { Colors } from '@/constants/Colors'
import { useColorScheme } from '@/hooks/useColorScheme'

// ➜ Lucide icons
// Install if needed:
//   yarn add lucide-react-native
//   npx expo install react-native-svg
import { AppNavHeader } from '@/components/ui/headers'
import TabBarBackground from '@/components/ui/TabBarBackground'
import { AuthGate } from '@/features/splash'
import { PortalHost } from '@rn-primitives/portal'
import { Compass, Home, Layers, Scan, Store, User } from 'lucide-react-native'

export default function TabLayout() {
  const { colorScheme } = useColorScheme()

  return (
    <AuthGate>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          header: (props) => <AppNavHeader {...props} />,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: {
            zIndex: 10,
            ...Platform.select({
                ios: { position: 'relative' },
                default: {},
          })},
        }}
        
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Home size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => <Compass size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            title: 'Collection',
            tabBarIcon: ({ color }) => <Layers size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="marketplace"
          options={{
            title: 'Marketplace',
            tabBarIcon: ({ color }) => <Store size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ color }) => <Scan size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <User size={28} color={color} />,
          }}
        />
        
      </Tabs>

      <PortalHost name="searchbar" />
    </AuthGate>
  )
}
