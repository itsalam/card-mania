import { useUnreadCount } from '@/client/notifications'
import { HapticTab } from '@/components/tabs/HapticTab'
import { AppNavHeader } from '@/components/ui/headers'
import { useCartCount, useOpenCart } from '@/features/cart/hooks'
import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { AuthGate } from '@/features/splash'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { PortalHost } from '@rn-primitives/portal'
import * as Haptics from 'expo-haptics'
import { Tabs } from 'expo-router'
import {
  ArrowLeftRight,
  Bell,
  Home,
  Inbox,
  Layers,
  Scan,
  ShoppingBag,
  ShoppingCart,
  User,
} from 'lucide-react-native'
import React from 'react'
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'

const TAB_BAR_HEIGHT = 58
const PILL_HEIGHT = 44
const PILL_WIDTH = 148
const FLOAT_MARGIN = 16

function FloatingCartButton() {
  const count = useCartCount()
  const openCart = useOpenCart()
  const { width: screenW, height: screenH } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const defaultX = screenW - PILL_WIDTH - FLOAT_MARGIN
  const defaultY = screenH - TAB_BAR_HEIGHT - insets.bottom - PILL_HEIGHT - FLOAT_MARGIN * 2

  const translateX = useSharedValue(defaultX)
  const translateY = useSharedValue(defaultY)
  const scale = useSharedValue(1)

  const panGesture = Gesture.Pan()
    .onStart(() => {
      scale.value = withSpring(1.05, { damping: 10 })
    })
    .onChange((e) => {
      translateX.value += e.changeX
      translateY.value += e.changeY
    })
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 12 })
      const snapRight = translateX.value + PILL_WIDTH / 2 > screenW / 2
      translateX.value = withSpring(
        snapRight ? screenW - PILL_WIDTH - FLOAT_MARGIN : FLOAT_MARGIN,
        { damping: 20, stiffness: 200 }
      )
      translateY.value = withSpring(
        Math.max(insets.top + FLOAT_MARGIN, Math.min(translateY.value, defaultY)),
        { damping: 20, stiffness: 200 }
      )
    })

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  if (count === 0) return null

  return (
    <Animated.View
      entering={FadeIn.springify().damping(14)}
      exiting={FadeOut.duration(150)}
      style={[
        floatStyles.button,
        animStyle,
        {
          borderColor: Colors.$outlineGeneral,
          backgroundColor: Colors.$backgroundElevated,
        },
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <Pressable
          onPress={openCart}
          onPressIn={() => {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Open cart"
          style={floatStyles.buttonInner}
        >
          <ShoppingCart size={18} color={Colors.$iconDefault} />
          <Text
            style={[
              floatStyles.label,
              {
                color: Colors.$textDefault,
              },
            ]}
          >
            View Cart
          </Text>
          <View
            style={[
              floatStyles.floatBadge,
              {
                backgroundColor: Colors.$outlinePrimary,
              },
            ]}
          >
            <Text style={floatStyles.floatBadgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        </Pressable>
      </GestureDetector>
    </Animated.View>
  )
}

function NotificationTabIcon({ color }: { color: string }) {
  const { data: unreadCount = 0 } = useUnreadCount()

  return (
    <View style={styles.cartIconWrapper}>
      <Bell size={24} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </View>
  )
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  const visibleRoutes = state.routes.filter(
    (route) => (descriptors[route.key].options.tabBarItemStyle as any)?.display !== 'none'
  )

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: insets.bottom - 8,
        paddingHorizontal: 12,
        paddingTop: 8,
        backgroundColor: 'transparent',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 2,
          paddingHorizontal: 6,
          paddingVertical: 5,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
          backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
        }}
      >
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key]
          const routeIndex = state.routes.indexOf(route)
          const isFocused = state.index === routeIndex
          const iconColor = isFocused ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral

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
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                paddingVertical: 6,
              }}
            >
              {options.tabBarIcon?.({ focused: isFocused, color: iconColor, size: 20 })}
              <Text
                style={{ fontSize: 9, color: iconColor, fontWeight: isFocused ? '600' : '400' }}
              >
                {options.title}
              </Text>
            </HapticTab>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
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
})

const floatStyles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 100,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  floatBadge: {
    borderRadius: 99,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  floatBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
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
          name="marketplace"
          options={{
            title: 'Market',
            tabBarIcon: ({ color }) => <ShoppingBag size={24} color={color} />,
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
          name="offers"
          options={{
            title: 'Offers',
            tabBarIcon: ({ color }) => <Inbox size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Trades',
            tabBarIcon: ({ color }) => <ArrowLeftRight size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color }) => <NotificationTabIcon color={color} />,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ color }) => <Scan size={24} color={color} />,
            tabBarItemStyle: { display: 'none' },
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

      <FloatingCartButton />
      <PortalHost name="searchbar" />
    </AuthGate>
  )
}
