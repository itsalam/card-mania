import Logo from '@/assets/images/logo.svg'
import { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text/base-text'
import { MainSearchBar } from '@/features/mainSearchbar'
import { OnboardingTarget } from '@/features/onboarding'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import { Compass, History, LucideIcon, Newspaper, SettingsIcon, Sheet } from 'lucide-react-native'
import React, { useCallback, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
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
  const {
    tabsExpanded,
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
  } = useCollaspableHeader({ disable: false, defaultHeight: GRAPH_SECTION_HEIGHT })

  return (
    <SafeAreaView className="flex-1 w-full h-full overflow-visible" style={{ paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
        <Logo width={48} height={48} />
        <Text variant={'large'}>Welcome back, {displayName}</Text>
        <OnboardingTarget id="settings-icon" style={{ marginLeft: 'auto' }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile/settings')}
            accessibilityLabel="Open settings"
          >
            <SettingsIcon size={32} color={Colors.$iconDefault} />
          </TouchableOpacity>
        </OnboardingTarget>
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
