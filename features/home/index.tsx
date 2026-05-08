import Logo from '@/assets/images/logo.svg'
import { useUnreadCount } from '@/client/notifications'
import { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text/base-text'
import { MainSearchBar } from '@/features/mainSearchbar'
import { OnboardingTarget } from '@/features/onboarding'
import { useRefresh } from '@/lib/hooks/useRefresh'
import { useUserStore } from '@/lib/store/useUserStore'
import { useQueryClient } from '@tanstack/react-query'
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
import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import CollectionBreakdown from '../collection/components/CollectionBreakdown'

import { useCollaspableHeader } from '../collection/ui'
import { Graphs } from './Breakdowns'
import { ExplorePage } from './ExplorePage'
import { FeedPage } from './FeedPage'
import { TabValue, tabValues, useHomePageStore } from './provider'

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
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { profile, user } = useUserStore()
  const { data: unreadCount = 0 } = useUnreadCount()

  // Resolve the best available display name for the greeting
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
  const qc = useQueryClient()
  const {
    tabsExpanded,
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
    virtualOffset,
  } = useCollaspableHeader({ disable: false, defaultHeight: GRAPH_SECTION_HEIGHT })

  const { refreshing, onRefresh } = useRefresh(
    [() => qc.refetchQueries({ type: 'active' })],
    () => {
      virtualOffset.value = 0
    }
  )

  return (
    <SafeAreaView className="flex-1 w-full h-full overflow-visible" style={{ paddingTop: 8 }}>
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

      <OnboardingTarget id="collection-breakdown">
        <CollectionBreakdown
          style={{
            paddingTop: 12,
            marginBottom: 20,
            marginHorizontal: 12,
          }}
          selectedCollections={selectedCollections}
          onToggleCollection={toggleCollection}
        />
      </OnboardingTarget>
      <GestureDetector gesture={composedGestures}>
        <View style={{ height: 500 }}>
          <Animated.View
            style={[
              {
                // backgroundColor: Colors.$backgroundNeutral,
                margin: 8,
                borderColor: Colors.$outlineDefault,
                borderWidth: 2,
                // borderBottomColor: Colors.$outlineDefault,
                // borderBottomWidth: 2,
                overflow: 'hidden',
                borderRadius: BorderRadiuses.br40,
              },
              headerAnimatedStyle,
            ]}
            onLayout={onHeaderLayout}
          >
            <OnboardingTarget id="collection-graphs">
              <Graphs height={GRAPH_SECTION_HEIGHT} selectedCollections={selectedCollections} />
            </OnboardingTarget>
          </Animated.View>
          <Tabs
            className="flex-1"
            value={currentPage}
            onValueChange={setCurrentPage}
            style={{ height: 400, width: '100%' }}
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
                            size: 16,
                            color: isCurrent ? Colors.$textPrimary : Colors.$textDefault,
                          })
                        }
                      />
                    </TabsTrigger>
                  ))}

                  {/* <TabOptions currentTab={currentPage} /> */}
                </TabsList>
              </OnboardingTarget>

              <TabsList style={{ height: 48 }}>
                <TabsTrigger key={'Recents'} value={'Recents'} style={{}}>
                  <TabsLabel
                    value={'Recents'}
                    leftElement={(isCurrent) =>
                      React.createElement(History, {
                        size: 24,
                        color: isCurrent ? Colors.$textPrimary : Colors.$textDefault,
                      })
                    }
                  />
                </TabsTrigger>
              </TabsList>
            </View>
            <AnimatedScrollView
              className="flex-grow"
              style={{ paddingBottom: insets.bottom }}
              contentContainerStyle={{
                flexGrow: 1,
              }}
              ref={scrollViewRef}
              onLayout={onListLayout}
              onContentSizeChange={onContentSizeChange}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
    </SafeAreaView>
  )
}
