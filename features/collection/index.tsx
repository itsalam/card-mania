import { CollectionIdArgs } from '@/client/collections/types'
import { FolderTabsContainer } from '@/components/tabs/FolderTabs'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text'
import MaskedView from '@react-native-masked-view/masked-view'
import { Coins, Heart, Layers, LucideIcon, Plus, Vault, X } from 'lucide-react-native'
import { motify } from 'moti'
import React, { useEffect, useRef, useState } from 'react'
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  DerivedValue,
  Easing,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { LinearGradient } from 'expo-linear-gradient'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import CollectionBreakdown from './CollectionBreakdown'
import { useGetCollection } from './hooks'
import { CollectionsPage } from './pages/collection-items'
import { DefaultCollectionsPage } from './pages/default'
import {
  CollectionsViewProvider,
  DefaultPageTypes,
  defaultPages,
  useCollectionsPageStore,
} from './provider'

const tabIcons: Record<DefaultPageTypes, LucideIcon> = {
  default: Layers,
  vault: Vault,
  wishlist: Heart,
  selling: Coins,
}

const defaultTabContent: Record<DefaultPageTypes, React.ReactNode> = {
  default: <DefaultCollectionsPage />,
  wishlist: <CollectionsPage collectionKey={{ collectionType: 'wishlist' }} />,
  vault: <CollectionsPage collectionKey={{ collectionType: 'wishlist' }} />,
  selling: <CollectionsPage collectionKey={{ collectionType: 'wishlist' }} />,
}

const MText = motify(Text)()

export default function CollectionScreen() {
  return (
    <CollectionsViewProvider>
      <CollectionsPageLayout />
    </CollectionsViewProvider>
  )
}

const HeaderSection = () => {
  return (
    <View>
      <MText
        variant="h1"
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ duration: 500 }}
        style={{
          color: Colors.$textDefault,
        }}
      >
        {'Collections'}
      </MText>
      <CollectionBreakdown
        style={{
          paddingTop: 32,
          paddingVertical: 32,
        }}
      />
    </View>
  )
}

const CollectionTab = (props: { collectionKey: CollectionIdArgs }) => {
  const { collectionKey } = props
  const { currentPage } = useCollectionsPageStore()

  const key = [...Object.values(collectionKey)][0]
  const isDefault = Boolean(collectionKey.collectionType)
  const isCurrent = currentPage === key
  const { data: collection } = useGetCollection(collectionKey)
  const label = collection?.name ?? [...Object.values(collectionKey)][0].slice(0, 20)

  return (
    <TabsTrigger key={key} value={key} className="pt-px p-0">
      <TabsLabel
        label={label}
        value={key}
        className="text-xl"
        style={{
          color: Colors.$textDefault,
        }}
        containerStyle={{
          padding: 6,
          paddingHorizontal: 12,
          borderRadius: BorderRadiuses.br30,
          ...(isCurrent ? { borderColor: Colors.$outlineGeneral, borderWidth: 2 } : { padding: 8 }),
        }}
        leftElement={(current: boolean) =>
          React.createElement(tabIcons[key as keyof typeof tabIcons] ?? tabIcons['default'], {
            size: 20,
            color: current ? Colors.$textPrimary : Colors.$textDefault,
          })
        }
        rightElement={(current: boolean) =>
          current && !isDefault ? (
            <X size={16} color={current ? Colors.$textPrimary : Colors.$textDefault} />
          ) : null
        }
      />
    </TabsTrigger>
  )
}

type TabsSectionProps = {
  expanded?: boolean
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  scrollEnabled?: DerivedValue<boolean | undefined>
  onScrollTopChange?: (atTop: boolean) => void
}

const CollectionTabList = () => {
  const { currentPage, preferenceState } = useCollectionsPageStore()
  const { preferences } = preferenceState
  const scrollViewRef = useRef<FlatList>(null)
  const tabs = preferences.tabs ?? defaultPages.slice(1)

  useEffect(() => {
    const index = tabs.findIndex((tab) => tab === currentPage)
    if (index !== -1 && scrollViewRef) {
      scrollViewRef.current?.scrollToIndex({
        index,
        animated: true,
        // viewOffset: 20,
        viewPosition: 0.1,
      })
    }
  }, [tabs, currentPage])

  return (
    <View className="mx-3 pb-2 overflow-hidden mr-5" style={{ borderRadius: BorderRadiuses.br30 }}>
      <TabsList className="p-px pl-0 overflow-visible w-full items-start justify-start">
        <TabsTrigger
          key={defaultPages[0]}
          value={defaultPages[0]}
          style={{
            zIndex: 2,
            backgroundColor: Colors.$backgroundElevated,
            height: '100%',
            padding: 0,
          }}
        >
          <TabsLabel
            label={''}
            value={defaultPages[0]}
            className="text-xl"
            style={{ color: Colors.$textDefault }}
            leftElement={(current) =>
              React.createElement(tabIcons[defaultPages[0]], {
                size: 24,
                color: current ? Colors.$textPrimary : Colors.$textDefault,
                style: { marginBottom: 0 },
              })
            }
          />
        </TabsTrigger>
        <Separator orientation="vertical" className="mb-2 pb-2 z-10" />
        <MaskedView
          style={{ flex: 1.0, position: 'relative' }}
          maskElement={
            <LinearGradient
              // MaskedView uses the alpha channel: solid shows content, transparent hides it.
              colors={['transparent', 'black', 'black', 'transparent']}
              start={{ x: 0.0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.025, 0.95, 1]}
              style={{
                position: 'absolute',
                height: '100%',
                width: '100%',
                // top: '-2.5%',
                left: '-0%',
              }}
            />
          }
        >
          <FlatList
            ref={scrollViewRef}
            horizontal
            scrollIndicatorInsets={{ bottom: -10 }}
            style={{ overflow: 'visible', zIndex: 0 }}
            data={tabs}
            renderItem={({ item: tab }) => (
              <CollectionTab
                key={tab}
                collectionKey={{
                  ...(tab in defaultTabContent
                    ? { collectionType: tab as DefaultPageTypes }
                    : { collectionId: tab }),
                }}
              />
            )}
            contentContainerStyle={{
              paddingLeft: 4,
              paddingRight: 20,
              display: 'flex',
              flexDirection: 'row',
              gap: 0,
              zIndex: -1,
            }}
            ListFooterComponent={
              <TouchableOpacity
                style={{
                  alignSelf: 'stretch',
                  aspectRatio: 1,
                  padding: 8,
                }}
              >
                <View
                  style={{
                    borderColor: Colors.$outlineDefault,
                    display: 'flex',
                    borderWidth: 2,
                    borderRadius: BorderRadiuses.br40,
                    justifyContent: 'center',
                    alignItems: 'center',
                    aspectRatio: 1,
                  }}
                >
                  <Plus size={18} color={Colors.$textDefault} />
                </View>
              </TouchableOpacity>
            }
          >
            {/* </View> */}
          </FlatList>
        </MaskedView>
      </TabsList>
    </View>
  )
}

const CollectionsPageLayout = () => {
  const { currentPage, setCurrentPage, preferenceState } = useCollectionsPageStore()
  const { preferences } = preferenceState
  const tabs = preferences.tabs ?? defaultPages.slice(1)

  const [tabsExpanded, setTabsExpanded] = useState(false)
  const [scrollAtTop, setScrollAtTop] = useState(true)
  const measuredHeaderHeight = useSharedValue(0)
  const expandProgress = useSharedValue(0)
  const isAnimating = useSharedValue(false)

  //unused
  const gestureActive = useSharedValue(false)

  //new
  const scrollY = useSharedValue(0)
  const scrollAtTopSV = useSharedValue(true)
  const tabsExpandedSV = useSharedValue(tabsExpanded ? 1 : 0)
  const [scrollEnabled, setScrollEnabled] = useState(false)
  const isFirstRender = React.useRef(true)

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y
      scrollY.value = y

      const atTop = y <= 0 + 1 // small epsilon
      if (atTop !== scrollAtTopSV.value) {
        scrollAtTopSV.value = atTop
        scheduleOnRN(setScrollAtTop, atTop)
      }
    },
  })

  useEffect(() => {
    // whenever tabsExpanded changes, run the expand/collapse timing
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    tabsExpandedSV.value = tabsExpanded ? 1 : 0
    // no timeout needed anymore
  }, [tabsExpanded])

  const THRESHOLD = 0.35 // how far to drag before toggling
  const VELOCITY_TRIGGER = 400 // px/s-ish, tweak as needed

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      if (!scrollAtTopSV.value || isAnimating.value) return
      gestureActive.value = true
    })
    .onChange((e) => {
      if (!scrollAtTopSV.value || isAnimating.value) return
      if (measuredHeaderHeight.value <= 0) return

      const isExpanded = tabsExpandedSV.value === 1

      const drag = Math.max(0, e.translationY * (isExpanded ? 1 : -1)) // upward drag
      let progress = Math.min(1, drag / measuredHeaderHeight.value)
      if (isExpanded) progress = 1 - progress
      expandProgress.value = progress
      if (progress === 1) {
        scheduleOnRN(setScrollEnabled, true)
      }
    })
    .onEnd((e) => {
      if (!scrollAtTopSV.value) return
      if (measuredHeaderHeight.value <= 0) return

      gestureActive.value = false
      const isExpanded = tabsExpandedSV.value === 1
      const progress = expandProgress.value

      let nextExpanded = isExpanded

      if (!isExpanded) {
        // currently collapsed, user dragged up
        const draggedEnough = progress > THRESHOLD
        const flickedUp = e.velocityY < -VELOCITY_TRIGGER
        if (draggedEnough || flickedUp) {
          nextExpanded = true
        } else {
          nextExpanded = false
        }
      } else {
        // currently expanded, user dragged down
        const draggedEnough = progress < 1 - THRESHOLD
        const flickedDown = e.velocityY > VELOCITY_TRIGGER
        if (draggedEnough || flickedDown) {
          nextExpanded = false
        } else {
          nextExpanded = true
        }
      }

      expandProgress.value = withTiming(
        nextExpanded ? 1 : 0,
        {
          duration: 220,
          easing: Easing.out(Easing.ease),
        },
        (finished) => {
          if (finished) {
            isAnimating.set(false)
            scheduleOnRN(setScrollEnabled, nextExpanded)
            scheduleOnRN(setTabsExpanded, nextExpanded)
          }
        }
      )
      // let React state own the truth; effect above will animate expandProgress
    })
    .onFinalize(() => {
      gestureActive.value = false
    })

  const headerAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: 1 - expandProgress.value,
      height:
        measuredHeaderHeight.value > 0
          ? interpolate(expandProgress.value, [0, 1], [measuredHeaderHeight.value, 0])
          : undefined,
      transform: [{ translateY: interpolate(expandProgress.value, [0, 1], [0, -24]) }],
      pointerEvents: expandProgress.value >= 0.99 ? 'none' : ('auto' as any),
    }),
    [measuredHeaderHeight]
  )

  const nativeGesture = Gesture.Native()

  const composedGestures = Gesture.Simultaneous(panGesture, nativeGesture)
  const insets = useSafeAreaInsets()

  return (
    <SafeAreaView
      className="flex-1 w-full overflow-hidden"
      style={{ paddingTop: 8, paddingBottom: insets.bottom }}
    >
      <Animated.View
        style={[headerAnimatedStyle, { overflow: 'hidden' }]}
        onLayout={(e) => {
          if (!measuredHeaderHeight.value) measuredHeaderHeight.value = e.nativeEvent.layout.height
        }}
      >
        <HeaderSection />
      </Animated.View>
      <Tabs
        className="flex-1 gap-2"
        style={{ flex: 1 }}
        value={currentPage}
        onValueChange={setCurrentPage}
      >
        <CollectionTabList />
        <FolderTabsContainer>
          <GestureDetector gesture={composedGestures}>
            <Animated.ScrollView
              onScroll={onScroll}
              scrollEventThrottle={16}
              scrollEnabled={scrollEnabled}
              // contentContainerStyle={{ height: '100%' }}
            >
              <TabsContent key={defaultPages[0]} value={defaultPages[0]} className="h-full">
                <DefaultCollectionsPage />
              </TabsContent>

              {tabs.map((tab) => (
                <TabsContent key={tab} value={tab} className="h-full">
                  <View className={'gap-y-4 px-4 flex flex-col pt-4'}>
                    {tab in defaultTabContent ? (
                      defaultTabContent[tab as DefaultPageTypes]
                    ) : (
                      <CollectionsPage collectionKey={{ collectionId: tab }} />
                    )}
                  </View>
                </TabsContent>
              ))}
            </Animated.ScrollView>
          </GestureDetector>
        </FolderTabsContainer>
      </Tabs>
    </SafeAreaView>
  )
}
