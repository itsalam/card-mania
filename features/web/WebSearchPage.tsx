import { useCardSearch } from '@/client/price-charting'
import { useImageProxy } from '@/client/image-proxy'
import { GradientBackground } from '@/components/Background'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchBar } from '@/components/ui/search'
import { Text } from '@/components/ui/text/base-text'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { NAV_CLEARANCE, NAV_TOP } from './layout-constants'
import { useWebUser } from './hooks/useWebUser'
import { WebNav } from './WebNav'
import { AuthModal } from './AuthModal'
import { TCardSearchItem } from '@/client/price-charting/types'
import { useCardStore } from '@/lib/store/provider'

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function CardResultItem({ item }: { item: TCardSearchItem }) {
  const { data: imageResult } = useImageProxy({
    cardId: item.card.id,
    imageType: 'front',
    variant: 'thumb',
    shape: 'card',
  })
  const setPrefetchData = useCardStore((s) => s.setPrefetchData)
  const router = useRouter()

  const price = item.card.latest_price

  const handlePress = () => {
    setPrefetchData(item.card.id, item.card)
    router.push(`/cards/${item.card.id}` as any)
  }

  return (
    <Pressable onPress={handlePress}>
      <View
        style={{
          backgroundColor: Colors.$backgroundElevated,
          borderRadius: 12,
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {imageResult?.url ? (
          <Image
            source={{ uri: imageResult.url }}
            style={{ width: '100%', aspectRatio: 5 / 7 }}
            contentFit="cover"
          />
        ) : (
          <Skeleton style={{ width: '100%', aspectRatio: 5 / 7 }} />
        )}
        <View style={{ padding: 10, gap: 2 }}>
          <Text variant="default" style={{ fontWeight: '600' }} numberOfLines={2}>
            {item.card.name}
          </Text>
          <Text variant="small" style={{ color: Colors.$textNeutral }} numberOfLines={1}>
            {item.card.set_name}
          </Text>
          {price != null && (
            <Text
              variant="small"
              style={{ color: Colors.$textSuccess ?? '#10b981', fontWeight: '600', marginTop: 4 }}
            >
              {formatPrice(price)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  )
}

function SkeletonCard() {
  return (
    <View
      style={{ backgroundColor: Colors.$backgroundElevated, borderRadius: 12, overflow: 'hidden' }}
    >
      <Skeleton style={{ width: '100%', aspectRatio: 5 / 7 }} />
      <View style={{ padding: 10, gap: 6 }}>
        <Skeleton style={{ height: 16, width: '80%', borderRadius: 4 }} />
        <Skeleton style={{ height: 12, width: '60%', borderRadius: 4 }} />
      </View>
    </View>
  )
}

export default function WebSearchPage() {
  const { width } = useWindowDimensions()
  const router = useRouter()
  const params = useLocalSearchParams<{ q?: string }>()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const currentUser = useWebUser()

  const [query, setQuery] = useState(params.q ?? '')

  useEffect(() => {
    if (params.q !== undefined) setQuery(params.q)
  }, [params.q])

  const syncUrl = useCallback(
    (q: string) => {
      router.setParams({ q })
    },
    [router]
  )

  const { data, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage } = useCardSearch({
    q: query,
    limit: 20,
  })

  const results: TCardSearchItem[] = data?.pages.flatMap((p) => p.results) ?? []

  const cols = width >= 1024 ? 5 : width >= 768 ? 4 : width >= 480 ? 3 : 2

  return (
    <GradientBackground style={{ flex: 1 }}>
      <WebNav
        currentUser={currentUser}
        searchQuery={query}
        onSearchChange={(q) => {
          setQuery(q)
          syncUrl(q)
        }}
        onSignInPress={() => setShowAuthModal(true)}
      />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: NAV_CLEARANCE + NAV_TOP,
          paddingBottom: 64,
          paddingHorizontal: width >= 768 ? 48 : 16,
          maxWidth: 1400,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        {/* Search input */}
        <View style={{ marginBottom: 32 }}>
          <Text variant="h2" style={{ marginBottom: 16 }}>
            Search Cards
          </Text>
          <SearchBar
            value={query}
            onChangeText={(q) => {
              setQuery(q)
              syncUrl(q)
            }}
            placeholder="Search by card name, set, player…"
            hideSideButton
          />
        </View>

        {/* Results */}
        {isFetching && !results.length ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            {Array.from({ length: cols * 2 }).map((_, i) => (
              <View key={i} style={{ width: `${100 / cols - 2}%` }}>
                <SkeletonCard />
              </View>
            ))}
          </View>
        ) : results.length === 0 && query.trim().length >= 2 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64, gap: 12 }}>
            <Text variant="h3">{`No results for "${query}"`}</Text>
            <Text variant="muted">Try a different card name, set, or player.</Text>
          </View>
        ) : query.trim().length < 2 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64, gap: 12 }}>
            <Text variant="muted">Start typing to search the card catalog.</Text>
          </View>
        ) : (
          <View>
            <Text variant="small" style={{ color: Colors.$textNeutral, marginBottom: 16 }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              {results.map((item) => (
                <View key={item.id} style={{ width: `${Math.floor(100 / cols) - 2}%` }}>
                  <CardResultItem item={item} />
                </View>
              ))}
            </View>

            {hasNextPage && (
              <View style={{ alignItems: 'center', marginTop: 32 }}>
                {isFetchingNextPage ? (
                  <SkeletonCard />
                ) : (
                  <Text
                    onPress={() => fetchNextPage()}
                    style={{
                      color: Colors.$backgroundPrimaryLight,
                      textDecorationLine: 'underline',
                      cursor: 'pointer' as any,
                    }}
                  >
                    Load more
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </GradientBackground>
  )
}
