import Logo from '@/assets/images/logo.svg'
import { useUnreadCount } from '@/client/notifications'
import { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text/base-text'
import { MainSearchBar } from '@/features/mainSearchbar'
import { OnboardingTarget } from '@/features/onboarding'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import {
  Bell,
  Compass,
  History,
  LucideIcon,
  Newspaper,
  SettingsIcon,
  Sheet,
} from 'lucide-react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import CollectionBreakdown from '../collection/components/CollectionBreakdown'

import { useCollaspableHeader } from '../collection/ui'
import { Graphs } from './Breakdowns'
import { ExplorePage } from './ExplorePage'
import { FeedPage } from './FeedPage'
import { TabValue, tabValues, useHomePageStore } from './provider'
import { HomeRefreshProvider, useHomeRefreshControl } from './refresh-provider'

const notifBadgeStyles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dotText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
})

const tabIcons: Record<TabValue, LucideIcon> = {
  feed: Newspaper,
  explore: Compass,
  sheets: Sheet,
}

const tabContent: Record<TabValue, React.ReactNode> = {
  feed: <FeedPage />,
  explore: <ExplorePage />,
  sheets: <FeedPage />, // Placeholder for sheets
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

export default function HomeScreen() {
  const { currentPage, setCurrentPage } = useHomePageStore()
  const router = useRouter()
  const { profile, user } = useUserStore()
  const { data: unreadCount = 0 } = useUnreadCount()
  const displayName =
    profile?.display_name ?? profile?.username ?? user?.email?.split('@')[0] ?? 'there'

  const GRAPH_SECTION_HEIGHT = 284
  const [selectedCollections, setSelectedCollections] = useState<string[]>([
    'wishlist',
    'selling',
    'vault',
  ])
  const toggleCollection = useCallback((type: string) => {
    setSelectedCollections((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }, [])
  const {
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
    virtualOffset,
    pullDistance,
    pullRefreshTrigger,
  } = useCollaspableHeader({ disable: false, defaultHeight: GRAPH_SECTION_HEIGHT })

  return (
    <SafeAreaView className="flex-1 w-full h-full overflow-visible" style={{ paddingTop: 8 }}>
      {/* Logo row and search bar — outside gesture area */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
        <Logo width={48} height={48} />
        <Text variant={'large'}>Welcome back, {displayName}</Text>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/notifications')}
            accessibilityLabel="Open notifications"
            style={{ padding: 4 }}
          >
            <View>
              <Bell size={26} color={Colors.$iconDefault} />
              {unreadCount > 0 && (
                <View style={notifBadgeStyles.dot}>
                  <Text style={notifBadgeStyles.dotText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <OnboardingTarget id="settings-icon">
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile/settings')}
              accessibilityLabel="Open settings"
              style={{ padding: 4 }}
            >
              <SettingsIcon size={26} color={Colors.$iconDefault} />
            </TouchableOpacity>
          </OnboardingTarget>
        </View>
      </View>
      <OnboardingTarget id="search-bar">
        <MainSearchBar />
      </OnboardingTarget>

      <HomeRefreshProvider
        onStart={() => {
          virtualOffset.value = 0
        }}
      >
        <HomeGestureContent
          composedGestures={composedGestures}
          scrollViewRef={scrollViewRef}
          onListLayout={onListLayout}
          onContentSizeChange={onContentSizeChange}
          onHeaderLayout={onHeaderLayout}
          headerAnimatedStyle={headerAnimatedStyle}
          selectedCollections={selectedCollections}
          onToggleCollection={toggleCollection}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          graphHeight={GRAPH_SECTION_HEIGHT}
          pullDistance={pullDistance}
          pullRefreshTrigger={pullRefreshTrigger}
        />
      </HomeRefreshProvider>
    </SafeAreaView>
  )
}

const PULL_THRESHOLD = 80

function HomeGestureContent({
  composedGestures,
  scrollViewRef,
  onListLayout,
  onContentSizeChange,
  onHeaderLayout,
  headerAnimatedStyle,
  selectedCollections,
  onToggleCollection,
  currentPage,
  setCurrentPage,
  graphHeight,
  pullDistance,
  pullRefreshTrigger,
}: {
  composedGestures: any
  scrollViewRef: any
  onListLayout: (e: any) => void
  onContentSizeChange: (w: number, h: number) => void
  onHeaderLayout: (e: any) => void
  headerAnimatedStyle: any
  selectedCollections: string[]
  onToggleCollection: (type: string) => void
  currentPage: string
  setCurrentPage: (v: string) => void
  graphHeight: number
  pullDistance: SharedValue<number>
  pullRefreshTrigger: SharedValue<number>
}) {
  const insets = useSafeAreaInsets()
  const { refreshing, onRefresh } = useHomeRefreshControl()
  const isRefreshingShared = useSharedValue(false)

  useEffect(() => {
    isRefreshingShared.value = refreshing
  }, [refreshing])

  useAnimatedReaction(
    () => pullRefreshTrigger.value,
    (curr, prev) => {
      if (curr > (prev ?? 0)) runOnJS(onRefresh)()
    }
  )

  const INDICATOR_HEIGHT = 40

  const pullIndicatorStyle = useAnimatedStyle(() => {
    const progress = Math.min(pullDistance.value / PULL_THRESHOLD, 1)
    const height = isRefreshingShared.value
      ? INDICATOR_HEIGHT
      : interpolate(progress, [0, 1], [0, INDICATOR_HEIGHT])
    return {
      height,
      opacity: isRefreshingShared.value ? 1 : progress,
      overflow: 'hidden',
    }
  })

  return (
    <GestureDetector gesture={composedGestures}>
      <View style={{ flex: 1 }}>
        {/* Pull-to-refresh indicator — in flow so content shifts down */}
        <Animated.View
          style={[{ alignItems: 'center', justifyContent: 'center' }, pullIndicatorStyle]}
        >
          <ActivityIndicator size="small" color={Colors.$iconDefault} />
        </Animated.View>

        <OnboardingTarget id="collection-breakdown">
          <CollectionBreakdown
            style={{
              paddingTop: 12,
              marginBottom: 8,
              marginHorizontal: 12,
            }}
            selectedCollections={selectedCollections}
            onToggleCollection={onToggleCollection}
          />
        </OnboardingTarget>

        <Animated.View
          style={[
            {
              margin: 8,
              borderColor: Colors.$outlineDefault,
              borderWidth: 2,
              overflow: 'hidden',
              borderRadius: BorderRadiuses.br40,
            },
            headerAnimatedStyle,
          ]}
          onLayout={onHeaderLayout}
        >
          <OnboardingTarget id="collection-graphs">
            <Graphs height={graphHeight} selectedCollections={selectedCollections} />
          </OnboardingTarget>
        </Animated.View>
        <Tabs
          className="flex-1"
          value={currentPage}
          onValueChange={setCurrentPage}
          style={{ width: '100%' }}
        >
          <View style={{ flexDirection: 'row' }}>
            <OnboardingTarget id="tab-list">
              <TabsList className="ml-4" style={{ height: 48 }}>
                {tabValues.map((tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    <TabsLabel
                      label={tab}
                      value={tab}
                      leftElement={(isCurrent) =>
                        React.createElement(tabIcons[tab], {
                          size: 13,
                          color: isCurrent ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral,
                        })
                      }
                    />
                  </TabsTrigger>
                ))}
              </TabsList>
            </OnboardingTarget>

            <TabsList style={{ height: 48 }}>
              <TabsTrigger key={'Recents'} value={'Recents'} style={{}}>
                <TabsLabel
                  value={'Recents'}
                  leftElement={(isCurrent) =>
                    React.createElement(History, {
                      size: 13,
                      color: isCurrent ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral,
                    })
                  }
                />
              </TabsTrigger>
            </TabsList>
          </View>
          <AnimatedScrollView
            className="flex-grow"
            style={{ paddingBottom: insets.bottom }}
            contentContainerStyle={{ flexGrow: 1 }}
            ref={scrollViewRef}
            onLayout={onListLayout}
            onContentSizeChange={onContentSizeChange}
          >
            {tabValues.map((tab) => (
              <TabsContent key={tab} value={tab} className="flex-1">
                {tabContent[tab]}
              </TabsContent>
            ))}
          </AnimatedScrollView>
        </Tabs>
      </View>
    </GestureDetector>
  )
}
