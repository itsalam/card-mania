/**
 * Root-level dynamic username route.
 *
 * Creates clean public URLs:  cardmania.app/johndoe
 *   → renders the same storefront as  cardmania.app/storefront/johndoe
 *
 * Expo Router evaluates static routes before dynamic ones, so known paths
 * like /cart, /cards/*, /storefront/*, etc. are NEVER matched here.
 * Only unrecognised slugs (user handles) fall through to this segment.
 *
 * On native this is unlikely to be hit directly (deep links go to
 * /storefront/[username]) but it renders gracefully if it is.
 */
import { Text } from '@/components/ui/text/base-text'
import { getUserStoreFront } from '@/features/profile/client'
import { getSupabase } from '@/lib/store/client'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, View, useWindowDimensions } from 'react-native'

import { GradientBackground } from '@/components/Background'
import { Colors } from 'react-native-ui-lib'
import { AuthModal } from './AuthModal'
import { useWebUser } from './hooks/useWebUser'
import { NAV_CLEARANCE, NAV_TOP } from './layout-constants'
import { SellerSidebar } from './SellerSidebar'
import { StorefrontCatalog } from './StorefrontCatalog'
import { WebNav } from './WebNav'

export default function UsernameStorefrontPage() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [navQuery, setNavQuery] = useState('')
  const [cardQuery, setCardQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { width } = useWindowDimensions()
  const isPortrait = width < 768
  const currentUser = useWebUser()

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['public-storefront-profile', username],
    queryFn: async () => {
      if (!username) return null
      const { data: session } = await getSupabase().auth.getSession()
      console.log('[BrowserStorefront] profile lookup — username:', username, {
        hasSession: Boolean(session.session),
        isAnon: session.session?.user?.is_anonymous ?? null,
      })
      const { data, error } = await getSupabase()
        .from('user_profile')
        .select('user_id, username, display_name, avatar_url, bio, is_seller')
        .eq('username', username)
        .maybeSingle()
      if (error) console.error('[BrowserStorefront] user_profile query error:', error)
      return data ?? null
    },
    enabled: Boolean(username),
  })

  const { data: collections, isLoading: isLoadingCollections } = useQuery({
    queryKey: ['public-storefront-collections', profile?.user_id],
    queryFn: () => getUserStoreFront(profile?.user_id),
    enabled: Boolean(profile?.user_id),
  })

  const isLoading = isLoadingProfile || (Boolean(profile?.user_id) && isLoadingCollections)

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <WebNav
          currentUser={currentUser}
          searchQuery={navQuery}
          onSearchChange={setNavQuery}
          scrolled={scrolled}
          onSignInPress={() => setShowAuthModal(true)}
        />
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={{ flex: 1 }}>
        <WebNav
          currentUser={currentUser}
          searchQuery={navQuery}
          onSearchChange={setNavQuery}
          scrolled={scrolled}
          onSignInPress={() => setShowAuthModal(true)}
        />
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text variant="h2">Not found</Text>
          <Text variant="muted" style={{ marginTop: 8, textAlign: 'center' }}>
            No storefront found for @{username}
          </Text>
          <Link href="/" style={{ marginTop: 16 }}>
            <Text variant="muted" style={{ textDecorationLine: 'underline' }}>
              Back to CardMania
            </Text>
          </Link>
        </View>
      </View>
    )
  }

  const allCollections = collections ?? []
  const totalItemCount = allCollections.reduce((sum, c) => sum + ((c as any).item_count ?? 0), 0)

  return (
    <GradientBackground style={{ flex: 1 }}>
      <WebNav
        currentUser={currentUser}
        searchQuery={navQuery}
        onSearchChange={setNavQuery}
        scrolled={scrolled}
        onSignInPress={() => setShowAuthModal(true)}
      />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {isPortrait ? (
        /* Portrait: single scroll — sidebar header + bordered catalog */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 10)}
          scrollEventThrottle={16}
        >
          <SellerSidebar
            profile={profile}
            collections={allCollections}
            selectedCollectionId={selectedCollectionId}
            totalItemCount={totalItemCount}
            onSelectCollection={setSelectedCollectionId}
            portrait
          />
          <View
            style={{
              flex: 1,
              marginTop: 12,
              marginHorizontal: 12,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: Colors.$outlineNeutral,
              borderRadius: 20,
              overflow: 'hidden',
            }}
          >
            <StorefrontCatalog
              collectionId={selectedCollectionId}
              collections={allCollections}
              searchQuery={cardQuery}
              onSearchChange={setCardQuery}
              paddingTop={12}
            />
          </View>
        </ScrollView>
      ) : (
        /* Landscape: sidebar is a fixed flex column; only the catalog scrolls */
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <SellerSidebar
            profile={profile}
            collections={allCollections}
            selectedCollectionId={selectedCollectionId}
            totalItemCount={totalItemCount}
            onSelectCollection={setSelectedCollectionId}
          />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 10)}
            scrollEventThrottle={16}
          >
            <StorefrontCatalog
              collectionId={selectedCollectionId}
              collections={allCollections}
              searchQuery={cardQuery}
              onSearchChange={setCardQuery}
              paddingTop={NAV_CLEARANCE + NAV_TOP * 3}
            />
          </ScrollView>
        </View>
      )}
    </GradientBackground>
  )
}
