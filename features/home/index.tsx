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
import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { ExplorePage } from './ExplorePage'
import { FeedPage } from './FeedPage'
import { PortfolioSummary } from './PortfolioSummary'
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

export default function HomeScreen() {
  const { currentPage, setCurrentPage } = useHomePageStore()
  const router = useRouter()
  const { profile, user } = useUserStore()
  const { data: unreadCount = 0 } = useUnreadCount()
  const displayName =
    profile?.display_name ?? profile?.username ?? user?.email?.split('@')[0] ?? 'there'

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

  return (
    <SafeAreaView className="flex-1 w-full h-full overflow-visible" style={{ paddingTop: 8 }}>
      {/* Logo row and search bar — fixed outside scroll */}
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

      <HomeRefreshProvider>
        <HomeContent
          selectedCollections={selectedCollections}
          onToggleCollection={toggleCollection}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />
      </HomeRefreshProvider>
    </SafeAreaView>
  )
}

function HomeContent({
  selectedCollections,
  onToggleCollection,
  currentPage,
  setCurrentPage,
}: {
  selectedCollections: string[]
  onToggleCollection: (type: string) => void
  currentPage: string
  setCurrentPage: (v: string) => void
}) {
  const insets = useSafeAreaInsets()
  const { refreshing, onRefresh } = useHomeRefreshControl()

  return (
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
    >
      <OnboardingTarget id="collection-breakdown">
        <PortfolioSummary
          style={{ paddingTop: 12, marginBottom: 8, marginHorizontal: 12 }}
          selectedCollections={selectedCollections}
          onToggleCollection={onToggleCollection}
        />
      </OnboardingTarget>

      <Tabs value={currentPage} onValueChange={setCurrentPage} style={{ width: '100%' }}>
        <OnboardingTarget id="tab-list">
          <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>
            <TabsList
              className="overflow-visible items-start justify-start"
              style={{ paddingHorizontal: 4 }}
            >
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
                    containerStyle={{
                      padding: 4,
                    }}
                    style={{
                      padding: 1,
                    }}
                  />
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsList>
              <TabsTrigger key={'Recents'} value={'Recents'} style={{ aspectRatio: 1 }}>
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
        </OnboardingTarget>
        {tabValues.map((tab) => (
          <TabsContent key={tab} value={tab}>
            {tabContent[tab]}
          </TabsContent>
        ))}
      </Tabs>
    </ScrollView>
  )
}
