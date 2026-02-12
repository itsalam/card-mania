import Logo from '@/assets/images/logo.svg'
import { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text'
import { MainSearchBar } from '@/features/mainSearchbar'
import { Compass, History, LucideIcon, Newspaper, SettingsIcon, Sheet } from 'lucide-react-native'
import React from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
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
  const GRAPH_SECTION_HEIGHT = 260
  const {
    tabsExpanded,
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
  } = useCollaspableHeader(false, [], GRAPH_SECTION_HEIGHT)

  return (
    <SafeAreaView className="flex-1 w-full h-full overflow-visible" style={{ paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
        <Logo width={48} height={48} />
        <Text variant={'large'}>Welcome back, TODO: BUILD USER</Text>
        <TouchableOpacity style={{ marginLeft: 'auto' }}>
          <SettingsIcon size={32} />
        </TouchableOpacity>
      </View>
      <MainSearchBar />
      <CollectionBreakdown
        style={{
          paddingTop: 12,
          marginBottom: 20,
          marginHorizontal: 12,
        }}
      />
      <GestureDetector gesture={composedGestures}>
        <View style={{ height: 500 }}>
          <Animated.View
            style={[
              {
                backgroundColor: Colors.$backgroundNeutral,
                paddingTop: 8,
                borderTopColor: Colors.$outlineDefault,
                borderTopWidth: 2,
                borderBottomColor: Colors.$outlineDefault,
                borderBottomWidth: 2,
                overflow: 'hidden',
              },
              headerAnimatedStyle,
            ]}
            onLayout={onHeaderLayout}
          >
            <Graphs height={GRAPH_SECTION_HEIGHT} />
          </Animated.View>
          <Tabs
            className="flex-1"
            value={currentPage}
            onValueChange={setCurrentPage}
            style={{ height: 400, width: '100%' }}
          >
            <View style={{ flexDirection: 'row' }}>
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
