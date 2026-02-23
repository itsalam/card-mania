import React from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Spinner } from '@/components/ui/spinner'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useCollaspableHeader } from '../collection/ui'
import { Body } from './components/body'
import { ProfileHeader, SubHeader } from './components/profile-header'
import { StorefrontPage } from './pages/storefront'
import { UserProfilePageStoreProvider } from './providers'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

export default function ProfilePageLayout({ userId }: { userId?: string }) {
  const insets = useSafeAreaInsets()
  const loadingUser = !Boolean(userId)

  const {
    tabsExpanded,
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
  } = useCollaspableHeader(false, [])

  const body = userId ? (
    <UserProfilePageStoreProvider userId={userId}>
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
        <Body
          tabContent={{
            storefront: <StorefrontPage />,
          }}
        />
      </AnimatedScrollView>
    </UserProfilePageStoreProvider>
  ) : (
    <Spinner />
  )

  return (
    <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ProfileHeader />

      <GestureDetector gesture={composedGestures}>
        <View>
          <Animated.View onLayout={onHeaderLayout} style={[headerAnimatedStyle]}>
            <SubHeader />
          </Animated.View>
          {body}
        </View>
      </GestureDetector>
    </View>
  )
}
