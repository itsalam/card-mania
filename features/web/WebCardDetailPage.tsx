import { useCardQuery } from '@/client/card'
import { usePriceChartingDataBatch } from '@/client/chart-data'
import { useImageProxy } from '@/client/image-proxy'
import { GradientBackground } from '@/components/Background'
import FullPriceGraph from '@/components/graphs/PriceGraph'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { PriceSummaryBar } from '@/features/tcg-card-views/PriceSummaryBar'
import { RecentSalesList } from '@/features/tcg-card-views/RecentSalesList'
import { getSupabase } from '@/lib/store/client'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Link, useRouter } from 'expo-router'
import { ArrowLeft, Download, ExternalLink, Eye, EyeOff } from 'lucide-react-native'
import React, { useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { NAV_CLEARANCE, NAV_TOP } from './layout-constants'
import { useWebUser } from './hooks/useWebUser'
import { WebNav } from './WebNav'
import { AuthModal } from './AuthModal'

const APP_STORE_URL = 'https://apps.apple.com'
const PLAY_STORE_URL = 'https://play.google.com'
const COLOR_A = '#34d399'
const COLOR_B = '#818cf8'

function interpolateHex(a: string, b: string, t: number): string {
  const h = (s: string) =>
    [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)] as [
      number,
      number,
      number,
    ]
  const [r1, g1, b1] = h(a)
  const [r2, g2, b2] = h(b)
  const c = (v: number) => v.toString(16).padStart(2, '0')
  return `#${c(Math.round(r1 + (r2 - r1) * t))}${c(Math.round(g1 + (g2 - g1) * t))}${c(Math.round(b1 + (b2 - b1) * t))}`
}

function gradientN(n: number): string[] {
  if (n <= 0) return []
  if (n === 1) return [COLOR_A]
  return Array.from({ length: n }, (_, i) => interpolateHex(COLOR_A, COLOR_B, i / (n - 1)))
}

function formatPrice(cents: number): string {
  const d = cents / 100
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(d)
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

type Seller = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

function useCardSellers(cardId: string) {
  return useQuery<Seller[]>({
    queryKey: ['card-sellers', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('collection_items')
        .select(
          'id, ref_id, collections(id, is_storefront, user_profile(username, display_name, avatar_url))'
        )
        .eq('ref_id', cardId)
        .eq('item_kind', 'card')
        .limit(20)

      if (error || !data) return []
      return data
        .filter((item: any) => item.collections?.is_storefront)
        .map((item: any) => item.collections?.user_profile)
        .filter(Boolean)
        .slice(0, 5) as Seller[]
    },
    staleTime: 5 * 60_000,
  })
}

function CardDetailSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 32, padding: 32 }}>
      <Skeleton style={{ width: 320, aspectRatio: 5 / 7, borderRadius: 12 }} />
      <View style={{ flex: 1, gap: 16 }}>
        <Skeleton style={{ height: 36, width: '60%', borderRadius: 8 }} />
        <Skeleton style={{ height: 24, width: '40%', borderRadius: 8 }} />
        <Skeleton style={{ height: 160, borderRadius: 12 }} />
        <Skeleton style={{ height: 240, borderRadius: 12 }} />
      </View>
    </View>
  )
}

export default function WebCardDetailPage({ cardId }: { cardId: string }) {
  const { width } = useWindowDimensions()
  const isDesktop = width >= 768
  const router = useRouter()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [priceTab, setPriceTab] = useState<'chart' | 'sales'>('chart')
  const currentUser = useWebUser()

  const { data: card, loading, isPopulating } = useCardQuery(cardId)
  const { data: imageResult } = useImageProxy({
    cardId,
    imageType: 'front',
    variant: 'detail',
    shape: 'card',
    quality: 100,
  })

  const grades = useMemo(
    () => Object.entries((card?.grades_prices as Record<string, number | null>) ?? {}),
    [card]
  )
  const gradeKeys = useMemo(() => grades.filter(([, v]) => v != null).map(([k]) => k), [grades])
  const [selectedGrades, setSelectedGrades] = useState<string[]>([])

  const activeGrades = selectedGrades.length ? selectedGrades : gradeKeys.slice(0, 3)

  const { data: priceChartingData, isLoading: priceLoading } = usePriceChartingDataBatch({
    card,
    grades: activeGrades,
  })

  const gradeColors = useMemo(() => {
    const cs = gradientN(gradeKeys.length)
    return Object.fromEntries(gradeKeys.map((k, i) => [k, cs[i]]))
  }, [gradeKeys])

  const { data: sellers } = useCardSellers(cardId)

  useEffect(() => {
    console.log('[PriceHistory]', {
      cardId,
      cardName: card?.name,
      gradeKeys,
      activeGrades,
      hasGradesPrices:
        !!card?.grades_prices && Object.keys(card.grades_prices as object).length > 0,
      isLoading: priceLoading,
      isPending: priceChartingData?.pending,
      pointCount: priceChartingData?.priceData?.length ?? 0,
      priceData: priceChartingData?.priceData,
    })
  }, [priceLoading, priceChartingData, gradeKeys])

  const imageAspect = imageResult?.aspectRatio ?? 5 / 7

  if (!loading && !card && !isPopulating) {
    return (
      <GradientBackground style={{ flex: 1 }}>
        <WebNav
          currentUser={currentUser}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSignInPress={() => setShowAuthModal(true)}
        />
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}
        >
          <Text variant="h2">Card not found</Text>
          <Text variant="muted">{"This card doesn't exist or has been removed."}</Text>
          <Link href="/search" style={{ textDecorationLine: 'underline' }}>
            <Text style={{ color: Colors.$backgroundPrimaryLight }}>Back to search</Text>
          </Link>
        </View>
      </GradientBackground>
    )
  }

  return (
    <GradientBackground style={{ flex: 1 }}>
      <WebNav
        currentUser={currentUser}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSignInPress={() => setShowAuthModal(true)}
      />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: NAV_CLEARANCE + NAV_TOP,
          paddingBottom: 64,
          paddingHorizontal: isDesktop ? 48 : 16,
          maxWidth: 1200,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        {loading ? (
          <CardDetailSkeleton />
        ) : (
          <View
            style={{
              flexDirection: isDesktop ? 'row' : 'column',
              gap: 24,
              alignItems: isDesktop ? 'flex-start' : 'center',
            }}
          >
            {/* Card image with back button overlaid */}
            <View
              style={{
                width: isDesktop ? 260 : '80%',
                maxWidth: isDesktop ? 280 : 260,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {imageResult?.url ? (
                <Image
                  source={{ uri: imageResult.url }}
                  style={{ width: '100%', aspectRatio: imageAspect, borderRadius: 12 }}
                  contentFit="cover"
                />
              ) : (
                <Skeleton style={{ width: '100%', aspectRatio: imageAspect, borderRadius: 12 }} />
              )}
              <Pressable
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/search' as any)
                }
                style={({ pressed }) => ({
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(0,0,0,0.48)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.16)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.88 : 1 }],
                  opacity: pressed ? 0.8 : 1,
                  // @ts-ignore — cursor is web-only
                  cursor: 'pointer',
                })}
              >
                <ArrowLeft size={16} color="rgba(255,255,255,0.92)" />
              </Pressable>
            </View>

            {/* Right col: detail sections inside the elevated card */}
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.$backgroundElevated,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: Colors.$outlineNeutral ?? 'rgba(255,255,255,0.08)',
                padding: isDesktop ? 20 : 14,
                gap: 12,
                minWidth: 0,
              }}
            >
              {/* Header */}
              <View style={{ gap: 2, paddingBottom: 4 }}>
                <Text style={{ fontSize: 26, fontWeight: '700', color: Colors.$textDefault }}>
                  {card?.name ?? '—'}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    color: Colors.$textNeutral,
                    fontFamily: 'SpaceMono',
                  }}
                >
                  {card?.set_name ?? '—'}
                </Text>
                {card?.release_date && (
                  <Text variant="muted" style={{ fontSize: 11 }}>
                    {new Date(card.release_date).getFullYear()}
                  </Text>
                )}
              </View>

              {/* Price History card — contains grades, KPI bar, and chart/sales */}
              {card && (
                <View
                  style={{
                    backgroundColor: Colors.$backgroundDefault,
                    borderRadius: 14,
                    padding: 14,
                    gap: 10,
                  }}
                >
                  {/* Title + Chart/Sales toggle */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text variant="h3" style={{ fontSize: 16, fontWeight: '600' }}>
                      Price History
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
                        borderWidth: 1,
                        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
                        borderRadius: 999,
                        padding: 3,
                        gap: 2,
                      }}
                    >
                      {(['chart', 'sales'] as const).map((t) => {
                        const active = priceTab === t
                        return (
                          <Pressable
                            key={t}
                            onPress={() => setPriceTab(t)}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 6,
                              borderRadius: 999,
                              backgroundColor: active
                                ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35)
                                : 'transparent',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: active ? Colors.$textDefault : Colors.$textNeutral,
                              }}
                            >
                              {t === 'chart' ? 'Chart' : 'Sales'}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>

                  {/* KPI summary row */}
                  {priceChartingData?.priceData?.length ? (
                    <PriceSummaryBar
                      priceData={priceChartingData.priceData}
                      selectedGrades={activeGrades}
                      gradeColors={gradeColors}
                    />
                  ) : null}

                  {/* Grade chips — toggle series on the chart */}
                  {grades.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {grades.map(([key, value]) => {
                        const isActive = activeGrades.includes(key)
                        const color = gradeColors[key]
                        return (
                          <Pressable
                            key={key}
                            onPress={() =>
                              setSelectedGrades((prev) =>
                                prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]
                              )
                            }
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 5,
                              backgroundColor: Colors.$backgroundElevated,
                              borderRadius: 8,
                              paddingVertical: 6,
                              paddingHorizontal: 8,
                              opacity: value == null ? 0.4 : 1,
                              borderWidth: 1,
                              borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
                              borderLeftWidth: 3,
                              borderLeftColor: color
                                ? Colors.rgba(color, isActive ? 1 : 0.25)
                                : 'transparent',
                            }}
                          >
                            {isActive ? (
                              <Eye size={12} color={Colors.$iconDefault} />
                            ) : (
                              <EyeOff size={12} color={Colors.$iconDefault} />
                            )}
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '700',
                                fontFamily: 'SpaceMono',
                                color: isActive ? Colors.$textDefault : Colors.$textNeutral,
                                textTransform: 'uppercase',
                              }}
                            >
                              {formatLabel(key)}
                            </Text>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: Colors.$textDefault,
                              }}
                            >
                              {value != null ? formatPrice(value) : '—'}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  )}

                  {/* Chart or Sales list */}
                  {gradeKeys.length > 0 ? (
                    priceTab === 'chart' ? (
                      <FullPriceGraph<Record<string, string | number>>
                        xKey={'date' as any}
                        yKeys={activeGrades as any}
                        data={priceChartingData?.priceData}
                        colors={activeGrades.map((g) => gradeColors[g] ?? COLOR_A)}
                        pending={priceChartingData?.pending}
                        fetching={priceLoading}
                      />
                    ) : (
                      <RecentSalesList
                        priceData={
                          priceChartingData?.priceData ?? ([] as Record<string, string | number>[])
                        }
                        selectedGrades={activeGrades}
                        gradeColors={gradeColors}
                      />
                    )
                  ) : (
                    <Text variant="muted">No price data available for this card.</Text>
                  )}
                </View>
              )}

              {/* Sellers card */}
              {sellers && sellers.length > 0 && (
                <View
                  style={{
                    backgroundColor: Colors.$backgroundDefault,
                    borderRadius: 14,
                    padding: 14,
                    gap: 10,
                  }}
                >
                  <Text variant="h3" style={{ fontSize: 16, fontWeight: '600' }}>
                    Available From
                  </Text>
                  <View style={{ gap: 6 }}>
                    {sellers.map((seller) =>
                      seller?.username ? (
                        <Link
                          key={seller.username}
                          href={`/${seller.username}` as any}
                          style={{ textDecorationLine: 'none' }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              backgroundColor: Colors.$backgroundElevated,
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                            }}
                          >
                            <Text style={{ fontWeight: '600', fontSize: 13 }}>
                              {seller.display_name ?? seller.username}
                            </Text>
                            <Text variant="muted" style={{ fontSize: 12 }}>
                              @{seller.username}
                            </Text>
                            <ExternalLink size={12} color={Colors.$textNeutral} />
                          </View>
                        </Link>
                      ) : null
                    )}
                  </View>
                </View>
              )}

              {/* App download CTA card */}
              <View
                style={{
                  gap: 10,
                  backgroundColor: Colors.$backgroundNeutralHeavy ?? Colors.$backgroundDefault,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: Colors.$outlineNeutral ?? 'rgba(255,255,255,0.06)',
                }}
              >
                <Text variant="h3" style={{ fontSize: 16, fontWeight: '600' }}>
                  Get CardMania
                </Text>
                <Text variant="muted" style={{ fontSize: 12 }}>
                  Track prices, manage your collection, and make offers — all from the app.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Pressable
                    onPress={() => Linking.openURL(APP_STORE_URL)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: Colors.$backgroundPrimaryLight ?? '#3B82F6',
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}
                  >
                    <Download size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                      App Store
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => Linking.openURL(PLAY_STORE_URL)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      borderWidth: 1,
                      borderColor: Colors.$outlineNeutralLight,
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}
                  >
                    <Download size={14} color={Colors.$textNeutral} />
                    <Text style={{ fontWeight: '600', fontSize: 13 }}>Google Play</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </GradientBackground>
  )
}
