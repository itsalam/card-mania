import { HapticTab } from '@/components/tabs/HapticTab'
import { AppNavHeader } from '@/components/ui/headers'
import { useCartCount, useOpenCart } from '@/features/cart/hooks'
import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { AuthGate } from '@/features/splash'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useTheme } from '@react-navigation/native'
import { PortalHost } from '@rn-primitives/portal'
import * as Haptics from 'expo-haptics'
import { Tabs } from 'expo-router'
import { Compass, Home, Inbox, Layers, Scan, ShoppingCart, Store, User } from 'lucide-react-native'
import React, { useEffect } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const CURSOR_WIDTH = '80%'
const TAB_BAR_HEIGHT = 58
const TAB_BAR_PADDING_TOP = 8

function CartButton() {
  const count = useCartCount()
  const openCart = useOpenCart()
  const { colors } = useTheme()

  return (
    <Pressable
      onPress={openCart}
      onPressIn={() => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
      }}
      accessibilityRole="button"
      accessibilityLabel="Open cart"
      style={styles.tabButton}
    >
      <View style={styles.cartIconWrapper}>
        <ShoppingCart size={24} color={colors.text} />
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, { color: colors.text }]}>Cart</Text>
    </Pressable>
  )
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()

  // +1 for the cart button slot
  const numSlots = state.routes.length + 1
  const tabWidth = screenWidth / numSlots

  const cursorX = useSharedValue(state.index * tabWidth)

  useEffect(() => {
    cursorX.value = withSpring(state.index * tabWidth, {
      damping: 24,
      stiffness: 300,
      mass: 0.6,
    })
  }, [state.index, tabWidth])

  const cursorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cursorX.value }],
  }))

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
          height: TAB_BAR_HEIGHT + insets.bottom,
          zIndex: 10,
        },
      ]}
    >
      {/* Sliding cursor */}
      <Animated.View style={[styles.cursorTrack, cursorStyle, { width: tabWidth }]}>
        <View style={[styles.cursor, { backgroundColor: colors.primary }]} />
      </Animated.View>

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]
        const isFocused = state.index === index
        const color = isFocused ? colors.primary : colors.text

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params)
          }
        }

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key })
        }

        return (
          <HapticTab
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
          >
            {options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
            <Text style={[styles.tabLabel, { color }]}>{options.title}</Text>
          </HapticTab>
        )
      })}

      <CartButton />
    </View>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: TAB_BAR_PADDING_TOP,
  },
  cursorTrack: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  cursor: {
    width: CURSOR_WIDTH,
    height: 3,
    borderRadius: 2,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cartIconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  tabLabel: {
    fontSize: 10,
  },
})

export default function TabLayout() {
  const scheme = useEffectiveColorScheme()

  return (
    <AuthGate>
      <Tabs
        key={scheme ?? 'default'}
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          header: (props) => <AppNavHeader {...props} />,
          headerShown: false,
          ...Platform.select({
            ios: {},
            default: {},
          }),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Home size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => <Compass size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            title: 'Collection',
            tabBarIcon: ({ color }) => <Layers size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="marketplace"
          options={{
            title: 'Marketplace',
            tabBarIcon: ({ color }) => <Store size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="offers"
          options={{
            title: 'Offers',
            tabBarIcon: ({ color }) => <Inbox size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ color }) => <Scan size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <User size={24} color={color} />,
          }}
        />
        <Tabs.Screen name="cart" options={{ href: null }} />
      </Tabs>

      <PortalHost name="searchbar" />
    </AuthGate>
  )
}
