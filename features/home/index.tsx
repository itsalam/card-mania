import Logo from '@/assets/images/logo.svg'
import { useUnreadCount } from '@/client/notifications'
import { FadeScrollView } from '@/components/ui/fade-scroll'
import { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text/base-text'
import { MainSearchBar } from '@/features/mainSearchbar'
import { OnboardingTarget } from '@/features/onboarding'
import { useUserStore } from '@/lib/store/useUserStore'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
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
import { RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { RecentlyViewed } from './cards/RecentlyViewed'
import { ExplorePage } from './ExplorePage'
import { useFeedSections } from './FeedPage'
import { PortfolioSummary } from './PortfolioSummary'
import { TabValue, tabValues, useHomePageStore } from './provider'
import { HomeRefreshProvider, useHomeRefreshControl } from './refresh-provider'

// Matches Logo's own size (the tallest item in that row) so alignItems: 'center' has a definite
// band to center against — MainSearchBar's collapsed state renders an <ExpandableSearchBar>,
// whose height: '100%' needs a non-ambiguous parent height the same way Collection's header does
// (see features/collection/components/Header.tsx's HEADER_ROW_HEIGHT for the fuller writeup).
const HOME_TOP_ROW_HEIGHT = 48

const notifBadgeStyles = StyleSheet.create({
  // Rescaled alongside the Bell icon's size: 22 -> 19.
  dot: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  dotText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  // "Button group" chrome for Bell + Settings — one shared pill container, secondary to the
  // search bar so it should draw less attention, not compete with it. Uses the same
  // bg/border colors as Marketplace's view-mode toggle group (`styles.toggle` in
  // features/marketplace/index.tsx) — the established segmented-control convention documented
  // in CLAUDE.md — rather than the opaque backgroundNeutral/outlineNeutral used for primary
  // action buttons (search, filter).
  iconButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
    overflow: 'hidden',
  },
  // Slightly smaller than a primary icon button (Marketplace's filterButton uses padding: 8) to
  // read as secondary/utility without shrinking so far it's hard to tap.
  groupButton: {
    padding: 7,
  },
  groupDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.2),
  },
})

const tabIcons: Record<TabValue, LucideIcon> = {
  feed: Newspaper,
  explore: Compass,
  sheets: Sheet,
}

// 'feed' and 'sheets' (a placeholder reusing the feed for now) flatten their sections directly
// into the ScrollView for sticky headers, bypassing TabsContent; 'explore' uses TabsContent.
const FEED_TAB_VALUES: TabValue[] = ['feed', 'sheets']

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
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 20,
          paddingTop: 8,
        }}
      >
        <View style={notifBadgeStyles.iconButtonGroup}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/notifications')}
            accessibilityLabel="Open notifications"
            style={notifBadgeStyles.groupButton}
          >
            <View>
              <Bell size={19} color={Colors.$iconDefault} />
              {unreadCount > 0 && (
                <View style={notifBadgeStyles.dot}>
                  <Text style={notifBadgeStyles.dotText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <View style={notifBadgeStyles.groupDivider} />
          <OnboardingTarget id="settings-icon">
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile/settings')}
              accessibilityLabel="Open settings"
              style={notifBadgeStyles.groupButton}
            >
              <SettingsIcon size={19} color={Colors.$iconDefault} />
            </TouchableOpacity>
          </OnboardingTarget>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          gap: 12,
          height: HOME_TOP_ROW_HEIGHT,
        }}
      >
        <Logo width={48} height={48} />
        <Text variant={'large'} numberOfLines={1} style={{ flexShrink: 1 }}>
          Welcome back, {displayName}
        </Text>
        <View style={{ marginLeft: 'auto' }}>
          <OnboardingTarget id="search-bar">
            <MainSearchBar collapsed />
          </OnboardingTarget>
        </View>
      </View>

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
  const tabBarHeight = useBottomTabBarHeight()
  const { refreshing, onRefresh } = useHomeRefreshControl()
  const feed = useFeedSections()
  const isFeedTab = FEED_TAB_VALUES.includes(currentPage as TabValue)

  return (
    // PortfolioSummary and the tab-list row are fixed chrome above the ScrollView, not children
    // of it — only the feed's own section headers use stickyHeaderIndices.
    <Tabs value={currentPage} onValueChange={setCurrentPage} style={{ flex: 1 }}>
      <OnboardingTarget id="collection-breakdown">
        <PortfolioSummary
          style={{ paddingTop: 12, marginBottom: 8, marginHorizontal: 12 }}
          selectedCollections={selectedCollections}
          onToggleCollection={onToggleCollection}
        />
      </OnboardingTarget>

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

      <FadeScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        stickyHeaderIndices={isFeedTab ? feed.stickyHeaderIndices : undefined}
      >
        {isFeedTab && feed.children}
        <TabsContent value="explore">
          <ExplorePage />
        </TabsContent>
        <TabsContent value={'Recents'}>
          <RecentlyViewed />
        </TabsContent>
      </FadeScrollView>
    </Tabs>
  )
}
