import React, { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { TabsContent } from '@/components/ui/tabs'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { GestureBlockerProvider, useCollaspableHeader } from '../collection/ui'
import { Body } from './components/body'
import { ProfileHeader, SubHeader } from './components/profile-header'
import { ProfileTabList } from './components/tab-list'
import { StorefrontPage } from './pages/storefront'
import { tabsRecords, TabType, UserProfilePageStoreProvider } from './providers'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

export default function ProfilePageLayout({ userId }: { userId?: string }) {
  return (
    <UserProfilePageStoreProvider userId={userId}>
      <GestureBlockerProvider>
        <ProfilePageLayoutInner />
      </GestureBlockerProvider>
    </UserProfilePageStoreProvider>
  )
}

function ProfilePageLayoutInner({ userId }: { userId?: string }) {
  const insets = useSafeAreaInsets()

  const {
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
  } = useCollaspableHeader()

  const tabContent: Partial<Record<TabType, ReactNode>> = {
    storefront: <StorefrontPage />,
  }

  return (
    <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ProfileHeader />

      <Body>
        <Animated.View style={[headerAnimatedStyle]}>
          <View onLayout={onHeaderLayout}>
            <SubHeader />
          </View>
        </Animated.View>

        <View style={{ paddingHorizontal: 6 }}>
          <ProfileTabList />
        </View>
        <View
          style={{
            marginTop: 12,
            borderTopLeftRadius: BorderRadiuses.br60,
            borderTopEndRadius: BorderRadiuses.br60,
            backgroundColor: Colors.$backgroundNeutralLight,
          }}
        >
          <GestureDetector gesture={composedGestures}>
            <AnimatedScrollView
              ref={scrollViewRef}
              onLayout={onListLayout}
              onContentSizeChange={onContentSizeChange}
            >
              {Object.keys(tabsRecords).map((tab) => (
                <TabsContent key={tab} value={tab} className="flex-1">
                  {tabContent[tab as TabType]}
                </TabsContent>
              ))}
            </AnimatedScrollView>
          </GestureDetector>
        </View>
      </Body>
    </View>
  )
}
