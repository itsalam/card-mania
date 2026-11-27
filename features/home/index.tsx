import Logo from '@/assets/images/logo.svg'
import { useUnreadCount } from '@/client/notifications'
import { FadeScrollView } from '@/components/ui/fade-scroll'
import { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text/base-text'
import { CollapsibleHeaderEventsProvider, useCollaspableHeader } from '@/features/collection/ui'
import { MainSearchBar } from '@/features/mainSearchbar'
import { OnboardingTarget } from '@/features/onboarding'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useRouter } from 'expo-router'
import {
  Bell,
  Compass,
  History,
  LucideIcon,
  Newspaper,
  Search,
  SettingsIcon,
  Sheet,
} from 'lucide-react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { RecentlyViewed } from './cards/RecentlyViewed'
import { useExploreSections } from './ExplorePage'
import { useFeedSections } from './FeedPage'
import { PortfolioSummary } from './PortfolioSummary'
import { BREAKDOWN_SERIES, BreakdownSeries } from '../collection/components/CollectionBreakdown'

import { TabValue, tabValues, useHomePageStore } from './provider'
import { HomeRefreshProvider, useHomeRefreshControl } from './refresh-provider'
import { TickerTape } from './TickerTape'

// Header row: fits the logo (the tallest item) with a little room, so alignItems: 'center' has a
// definite band to center against. The logo stays larger than the round buttons, and search, the
// primary action, is a step larger than notifications/settings.
const HOME_TOP_ROW_HEIGHT = 56
const HOME_LOGO_SIZE = 52
const HOME_BUTTON_SIZE = 40
const HOME_SEARCH_SIZE = 50

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
  // Round header buttons (notifications, settings): the outlined, translucent pill convention
  // from Marketplace's view-mode toggle (CLAUDE.md segmented-control colours). Colours are
  // inline at render; this only holds the shape.
  roundButton: {
    width: HOME_BUTTON_SIZE,
    height: HOME_BUTTON_SIZE,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Search: the primary action, so a step larger and raised off the background.
  searchButton: {
    width: HOME_SEARCH_SIZE,
    height: HOME_SEARCH_SIZE,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
})

/** Read at render so the round buttons follow light/dark mode. */
function roundButtonColors() {
  return {
    backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
  }
}

const tabIcons: Record<TabValue, LucideIcon> = {
  feed: Newspaper,
  explore: Compass,
  sheets: Sheet,
}

// 'feed' and 'sheets' (a placeholder reusing the feed for now) flatten their sections directly
// into the ScrollView for sticky headers, bypassing TabsContent; 'explore' does the same via
// useExploreSections (its sticky element is the layout-toggle toolbar, not a section header).
// Only 'Recents' still goes through TabsContent.
const FEED_TAB_VALUES: TabValue[] = ['feed', 'sheets']

export default function HomeScreen() {
  const { currentPage, setCurrentPage } = useHomePageStore()
  const router = useRouter()
  const { data: unreadCount = 0 } = useUnreadCount()

  // Which value lines the Home chart shows (PC, For sale, Wishlist); all on by default.
  const [selectedSeries, setSelectedSeries] = useState<string[]>([...BREAKDOWN_SERIES])
  const toggleSeries = useCallback((series: BreakdownSeries) => {
    setSelectedSeries((prev) =>
      prev.includes(series) ? prev.filter((t) => t !== series) : [...prev, series]
    )
  }, [])

  return (
    <SafeAreaView className="flex-1 w-full h-full overflow-visible" style={{ paddingTop: 8 }}>
      {/* Logo + app name on the left; notifications, settings and a larger raised search
          button on the right. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          gap: 8,
          height: HOME_TOP_ROW_HEIGHT,
        }}
      >
        {/* The name sits on the logo's bottom edge, lifted slightly off it. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
          <Logo width={HOME_LOGO_SIZE} height={HOME_LOGO_SIZE} />
          <Text variant="h4" numberOfLines={1} style={{ paddingBottom: 6 }}>
            ShadowBx
          </Text>
        </View>

        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/notifications')}
            accessibilityLabel="Open notifications"
            style={[notifBadgeStyles.roundButton, roundButtonColors()]}
          >
            <View>
              <Bell size={17} color={Colors.$iconDefault} />
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
              style={[notifBadgeStyles.roundButton, roundButtonColors()]}
            >
              <SettingsIcon size={17} color={Colors.$iconDefault} />
            </TouchableOpacity>
          </OnboardingTarget>
          <OnboardingTarget id="search-bar">
            <MainSearchBar
              renderTrigger={(open) => (
                <TouchableOpacity
                  onPress={open}
                  accessibilityLabel="Search"
                  style={[
                    notifBadgeStyles.searchButton,
                    {
                      backgroundColor: Colors.$backgroundElevated,
                      borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
                    },
                  ]}
                >
                  <Search size={21} color={Colors.$iconDefault} />
                </TouchableOpacity>
              )}
            />
          </OnboardingTarget>
        </View>
      </View>

      <HomeRefreshProvider>
        <HomeContent
          selectedSeries={selectedSeries}
          onToggleSeries={toggleSeries}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />
      </HomeRefreshProvider>
    </SafeAreaView>
  )
}

function HomeContent({
  selectedSeries,
  onToggleSeries,
  currentPage,
  setCurrentPage,
}: {
  selectedSeries: string[]
  onToggleSeries: (series: BreakdownSeries) => void
  currentPage: string
  setCurrentPage: (v: string) => void
}) {
  const tabBarHeight = useBottomTabBarHeight()
  const { refreshing, onRefresh } = useHomeRefreshControl()
  const feed = useFeedSections()
  const explore = useExploreSections()
  const isFeedTab = FEED_TAB_VALUES.includes(currentPage as TabValue)
  const isExploreTab = currentPage === 'explore'

  // Same collapsing header as Collection and Profile (features/collection/ui.tsx): one pan
  // gesture drives a virtual offset that first collapses PortfolioSummary (with its breakdown,
  // if open) and only then scrolls the feed, via scrollTo on the UI thread. Scrolling back up
  // reverses it: the feed returns to its top before the summary re-expands.
  const {
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
    virtualOffset,
    expandProgress,
    measuredHeaderHeight,
    headerCollapsing,
    pullRefreshTrigger,
    headerEvents,
  } = useCollaspableHeader({ showOnUpscroll: true })

  // The hook's own headerAnimatedStyle pins the header to its measured height even at rest,
  // which would clip the breakdown while it opens. At rest (progress 0) the height is left to
  // layout, so opening/closing the breakdown sizes naturally and is re-measured; the measured
  // height is only used while the header is actually collapsing.
  const headerStyle = useAnimatedStyle(() => {
    const p = expandProgress.value
    // Every key is returned in both branches: Reanimated keeps the last value of a key a style
    // stops returning, so leaving `height` out at rest kept the last collapse height applied and
    // clipped the breakdown when it next opened. 'auto' hands the height back to layout.
    if (p === 0 || measuredHeaderHeight.value <= 0) {
      return { height: 'auto', opacity: 1, transform: [{ translateY: 0 }] }
    }
    return {
      height: interpolate(p, [0, 1], [measuredHeaderHeight.value, 0]),
      opacity: 1 - p,
      transform: [{ translateY: interpolate(p, [0, 1], [0, -12]) }],
    }
  })

  // The ScrollView is driven by scrollTo (scrollEnabled={false}), so the native RefreshControl
  // never sees a pull; the hook's pull gesture counts it instead.
  useAnimatedReaction(
    () => pullRefreshTrigger.value,
    (next, prev) => {
      if (prev != null && next > prev) scheduleOnRN(onRefresh)
    },
    [onRefresh]
  )

  // A different tab is different content: start it from the top with the summary open.
  useEffect(() => {
    virtualOffset.value = 0
    scrollViewRef.current?.scrollTo({ y: 0, animated: false })
  }, [currentPage, virtualOffset, scrollViewRef])

  return (
    // PortfolioSummary and the ticker are the collapsing header; the tab-list row stays fixed
    // between it and the ScrollView. The feed's section headers and Explore's layout-toggle toolbar are
    // what use stickyHeaderIndices.
    <Tabs value={currentPage} onValueChange={setCurrentPage} style={{ flex: 1 }}>
      {/* One gesture surface for the whole screen, as on Collection: a vertical drag anywhere
          (the summary and its breakdown, the ticker, the tab row or the feed) drives the same
          virtual offset, so the header collapses and the feed scrolls no matter where the drag
          starts. Horizontal drags (ticker, rails, chart scrubbing) fail the pan and stay with
          their own scroll views. */}
      <GestureDetector gesture={composedGestures}>
        <Animated.View style={{ flex: 1 }}>
          <Animated.View style={[{ overflow: 'hidden' }, headerStyle]}>
            <View onLayout={onHeaderLayout}>
              <CollapsibleHeaderEventsProvider value={headerEvents}>
                <OnboardingTarget id="collection-breakdown">
                  <PortfolioSummary
                    style={{ paddingTop: 12, paddingBottom: 8, marginHorizontal: 12 }}
                    selectedSeries={selectedSeries}
                    onToggleSeries={onToggleSeries}
                  />
                </OnboardingTarget>
              </CollapsibleHeaderEventsProvider>
              {/* Lift the ticker so its left shoulder tab rises into the empty space beside the
                  breakdown's centered "View breakdown" chip. PortfolioSummary leaves 18px below
                  its card's border (the chip's lower half + padding); this lift tucks the tab
                  into that space. */}
              <TickerTape style={{ marginTop: -(10 + 1), marginBottom: 8 }} />
            </View>
          </Animated.View>

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
            animated
            // Matches GradientBackground (app/(tabs)/index.tsx), as on the Collection tab.
            fadeColor={Colors.$backgroundNeutralMedium}
            manualStart={headerCollapsing}
            ref={scrollViewRef}
            onLayout={onListLayout}
            onContentSizeChange={onContentSizeChange}
            scrollEnabled={false}
            bounces={false}
            style={{ flex: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: tabBarHeight + 16 }}
            stickyHeaderIndices={
              isFeedTab
                ? feed.stickyHeaderIndices
                : isExploreTab
                  ? explore.stickyHeaderIndices
                  : undefined
            }
          >
            {isFeedTab && feed.children}
            {isExploreTab && explore.children}
            <TabsContent value={'Recents'}>
              <RecentlyViewed />
            </TabsContent>
          </FadeScrollView>
        </Animated.View>
      </GestureDetector>
    </Tabs>
  )
}
