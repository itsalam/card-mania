import { useRefresh } from '@/lib/hooks/useRefresh'
import { useQueryClient } from '@tanstack/react-query'
import React, { ReactNode } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { TabsContent } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text/base-text'
import { useCartCount, useOpenCart } from '@/features/cart/hooks'
import { useUserStore } from '@/lib/store/useUserStore'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { BorderRadiuses, Colors, TouchableOpacity } from 'react-native-ui-lib'
import { ShoppingCart } from 'lucide-react-native'
import { GestureBlockerProvider, useCollaspableHeader } from '../collection/ui'
import { Body } from './components/body'
import { ProfileHeader, SubHeader } from './components/profile-header'
import { ProfileTabList } from './components/tab-list'
import { PostsPage } from './pages/posts'
import { StorefrontPage } from './pages/storefront'
import { tabsRecords, TabType, UserProfilePageStoreProvider, useUserProfilePage } from './providers'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

function CartFab({ bottom }: { bottom: number }) {
  const cartCount = useCartCount()
  const openCart = useOpenCart()
  return (
    <TouchableOpacity
      onPress={openCart}
      style={{
        position: 'absolute',
        bottom,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.$backgroundElevated,
        borderRadius: 999,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: Colors.$outlineGeneral,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
      <ShoppingCart size={18} color={Colors.$iconDefault} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.$textDefault }}>View Cart</Text>
      {cartCount > 0 && (
        <View
          style={{
            backgroundColor: Colors.$outlinePrimary,
            borderRadius: 99,
            minWidth: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', lineHeight: 12 }}>
            {cartCount > 9 ? '9+' : cartCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function ProfilePageLayout({ userId }: { userId?: string }) {
  return (
    <UserProfilePageStoreProvider userId={userId}>
      <GestureBlockerProvider>
        <ProfilePageLayoutInner />
      </GestureBlockerProvider>
    </UserProfilePageStoreProvider>
  )
}

function ProfilePageLayoutInner() {
  const insets = useSafeAreaInsets()
  const profileUser = useUserProfilePage((s) => s.user)
  const { user: authUser } = useUserStore()
  const isOwnProfile = !!authUser?.id && authUser.id === profileUser?.user_id

  const qc = useQueryClient()
  const {
    headerAnimatedStyle,
    composedGestures,
    scrollViewRef,
    onListLayout,
    onContentSizeChange,
    onHeaderLayout,
    virtualOffset,
  } = useCollaspableHeader()

  const { refreshing, onRefresh } = useRefresh(
    [() => qc.refetchQueries({ type: 'active' })],
    () => {
      virtualOffset.value = 0
    }
  )

  const tabContent: Partial<Record<TabType, ReactNode>> = {
    posts: <PostsPage />,
    storefront: <StorefrontPage />,
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom }}>
      <ProfileHeader />

      <Body style={{ flex: 1 }}>
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
            flex: 1,
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
              style={{ flex: 1 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              {Object.keys(tabsRecords).map((tab) => (
                <TabsContent key={tab} value={tab} className="flex-1">
                  {tabContent[tab as TabType]}
                </TabsContent>
              ))}
            </AnimatedScrollView>
          </GestureDetector>
          {!isOwnProfile && <CartFab bottom={insets.bottom + 16} />}
        </View>
      </Body>
    </View>
  )
}
