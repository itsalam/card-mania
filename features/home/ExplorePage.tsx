import {
  FeaturedListing,
  useMarketplaceSections,
  useRecommendedListings,
} from '@/client/marketplace'
import { SectionHeader } from '@/components/ui/section-header'
import { Text } from '@/components/ui/text/base-text'
import { type FeaturedCardItem } from '@/features/marketplace/FeaturedCard'
import { GridCard } from '@/features/marketplace/GridCard'
import { MarketListItem } from '@/features/marketplace/MarketListItem'
import {
  Clock,
  LayoutGrid,
  LayoutList,
  LucideIcon,
  Sparkles,
  TrendingUp,
} from 'lucide-react-native'
import React, { useMemo, useState } from 'react'
import { StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { ExploreLayout, useHomePageStore } from './provider'

// Design refs (ITS-108):
// - "For You" personalized section: Artsy's "For you" discover screen
//   (refero.design/screens/b1421f42-3d69-4c91-9a91-61de1272a5da) — marketplace-category app with
//   an explicit "For you" tab and a "Curators' Picks" section.
// - Trending section: Glow's NFT marketplace trending-collectibles list
//   (refero.design/screens/e73fbe4b-bd86-441d-be8d-2a60b4528625) — a collectibles marketplace
//   surfacing a ranked trending list with live prices, the direct analog for trending TCG listings.
// - New Listings / grid mode: Klarna SELEKT's luxury catalog grid
//   (refero.design/screens/4195081f-128c-4a5e-a21d-298b610a42e0) — two-column grid cards with
//   name/price, the precedent for Explore's grid layout of freshly-listed items.
// - Section order (personal-first, discovery-last) reuses the convention already cited on ITS-107
//   (Cash App "Stocks you own" / Stake Invest — holdings before discovery).
// - Sticky layout-toggle toolbar + pill segmented control: same bordered-pill/translucent-tint
//   convention as Marketplace's own ViewToggle (features/marketplace/index.tsx `styles.toggle`),
//   which CLAUDE.md's "Toggle / segmented-control styling" section documents as the app-wide
//   standard — the previous gluestack ToggleGroup-based version didn't match it (square segments,
//   opaque active fill), so it's replaced here rather than reused.
// - Grid/list modes are bespoke here (a full ExpandableCard wrap was tried and reverted — its own
//   collapse state hid the grid/list toggle's effect until a section was manually expanded, which
//   read as the toggle being broken). A third "gallery" mode (a horizontal FeaturedCard rail, via
//   ExpandableCard's extracted ItemRail) existed here too but was removed — grid/list only now.
// Mobbin citations pending — the Mobbin MCP connection was unavailable when this was built; add
// per CLAUDE.md's retroactive documentation note once it's reachable again.

function toFeaturedCardItem(listing: FeaturedListing): FeaturedCardItem {
  return { ...listing, id: listing.collection_item_id }
}

const LAYOUT_MODES: { mode: ExploreLayout; icon: LucideIcon; label: string }[] = [
  { mode: 'grid', icon: LayoutGrid, label: 'Grid' },
  { mode: 'list', icon: LayoutList, label: 'List' },
]

// Matches CLAUDE.md's toggle/segmented-control convention exactly (bordered pill container,
// translucent-tint active segment) — see features/marketplace/index.tsx's `styles.toggle` for the
// reference implementation this mirrors.
function LayoutToggle({
  value,
  onChange,
}: {
  value: ExploreLayout
  onChange: (mode: ExploreLayout) => void
}) {
  return (
    <View style={styles.toggle}>
      {LAYOUT_MODES.map(({ mode, icon: Icon, label }) => {
        const active = value === mode
        return (
          <TouchableOpacity
            key={mode}
            onPress={() => onChange(mode)}
            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Toggle ${label}`}
          >
            <Icon
              size={16}
              color={active ? Colors.$iconDefault : Colors.$iconNeutral}
              strokeWidth={active ? 2.5 : 2}
            />
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// Sticky toolbar (rendered at stickyHeaderIndices[0] by the caller) — needs its own opaque-ish
// backing since RN gives sticky items a permanent zIndex and scrolled content would otherwise
// show through. Same background/border pairing as CustomTabBar / TabsList (home/index.tsx,
// components/ui/tabs) rather than SectionHeader's blur treatment — a persistent toolbar reads
// better as a solid surface than a soft fade.
function ExploreMenuBar({
  value,
  onChange,
}: {
  value: ExploreLayout
  onChange: (mode: ExploreLayout) => void
}) {
  return (
    <View style={styles.menuBar}>
      <LayoutToggle value={value} onChange={onChange} />
    </View>
  )
}

// Mirrors features/marketplace/index.tsx's SectionItems-by-mode switch (same grid math, same
// MarketListItem/GridCard row components — Explore's data is FeaturedListing-shaped exactly like
// Marketplace's, so it reuses those renderers rather than duplicating them).
function ExploreSectionBody({ items, mode }: { items: FeaturedCardItem[]; mode: ExploreLayout }) {
  const { width: windowWidth } = useWindowDimensions()

  if (mode === 'grid') {
    const cellWidth = Math.floor((windowWidth - 32 - 12) / 2)
    const rows: FeaturedCardItem[][] = []
    for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2))
    return (
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 16 }}>
        {rows.map((pair, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row', gap: 12 }}>
            {pair.map((item) => (
              <GridCard key={item.id} item={item} width={cellWidth} />
            ))}
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      {items.map((item, i) => (
        <View key={item.id}>
          {i > 0 && (
            <View
              style={{
                height: 1,
                backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.15),
                marginVertical: 4,
              }}
            />
          )}
          <MarketListItem item={item} />
        </View>
      ))}
    </View>
  )
}

function ExploreSectionEmpty({ message }: { message: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
      <Text variant="small" style={{ color: Colors.$textNeutral }}>
        {message}
      </Text>
    </View>
  )
}

type ExploreSection = {
  key: string
  title: string
  icon: LucideIcon
  items: FeaturedCardItem[]
  isLoading: boolean
  emptyMessage: string
}

/**
 * Returns Explore's toolbar + each section's header/body as individual flattened nodes, mirroring
 * useFeedSections (FeedPage.tsx) — HomeContent flattens both directly into its single outer
 * ScrollView so `stickyHeaderIndices` can pin the layout-toggle toolbar (index 0). A self-contained
 * inner ScrollView here would work for a per-section sticky header, but same-axis nested
 * ScrollViews don't hand off scroll momentum in RN (see useExpandableSection's own writeup) — so,
 * like Feed, this stays flattened into the shared outer scroll instead.
 */
export function useExploreSections() {
  const { exploreLayout, setExploreLayout } = useHomePageStore()
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())

  const toggleSection = (key: string) =>
    setCollapsedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const { data: recommended = [], isLoading: recommendedLoading } = useRecommendedListings(20)
  // Shares Marketplace's cron-refreshed cache (client/marketplace's 'featured' section) instead of
  // a separate live get_featured_listings() call — same React Query cache entry as Marketplace,
  // so visiting both tabs in a session fires one fetch, not two.
  const { data: marketplaceSections = [], isLoading: sectionsLoading } = useMarketplaceSections()
  const featured = useMemo(
    () => marketplaceSections.find((s) => s.section_key === 'featured')?.items ?? [],
    [marketplaceSections]
  )

  const forYou = useMemo(() => recommended.map(toFeaturedCardItem), [recommended])
  const trending = useMemo(() => featured.map(toFeaturedCardItem), [featured])
  const newListings = useMemo(
    () =>
      [...featured]
        .sort((a, b) => new Date(b.listed_at ?? 0).getTime() - new Date(a.listed_at ?? 0).getTime())
        .map(toFeaturedCardItem),
    [featured]
  )

  // Personal-first, discovery-last ordering (see design-ref note above).
  const sections: ExploreSection[] = [
    {
      key: 'for_you',
      title: 'For You',
      icon: Sparkles,
      items: forYou,
      isLoading: recommendedLoading,
      emptyMessage: 'List a few cards or add to your wishlist to get personalized picks.',
    },
    {
      key: 'trending',
      title: 'Trending',
      icon: TrendingUp,
      items: trending,
      isLoading: sectionsLoading,
      emptyMessage: 'Nothing trending right now — check back soon.',
    },
    {
      key: 'new_listings',
      title: 'New Listings',
      icon: Clock,
      items: newListings,
      isLoading: sectionsLoading,
      emptyMessage: 'No new listings yet — check back soon.',
    },
  ]

  const children: React.ReactNode[] = []
  const stickyHeaderIndices: number[] = []

  stickyHeaderIndices.push(children.length)
  children.push(
    <ExploreMenuBar key="explore-menu-bar" value={exploreLayout} onChange={setExploreLayout} />
  )

  for (const section of sections) {
    const isOpen = !collapsedKeys.has(section.key)
    stickyHeaderIndices.push(children.length)
    children.push(
      <View key={`${section.key}-header`}>
        <SectionHeader
          icon={section.icon}
          title={section.title}
          isOpen={isOpen}
          onToggle={() => toggleSection(section.key)}
          expandable
        />
      </View>
    )
    children.push(
      <View key={`${section.key}-body`}>
        {isOpen &&
          (section.isLoading ? (
            <ExploreSectionEmpty message="Loading…" />
          ) : section.items.length === 0 ? (
            <ExploreSectionEmpty message={section.emptyMessage} />
          ) : (
            <ExploreSectionBody items={section.items} mode={exploreLayout} />
          ))}
      </View>
    )
  }

  return { children, stickyHeaderIndices }
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
    backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    borderRadius: 999,
    padding: 7,
  },
  toggleBtnActive: {
    backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35),
  },
  menuBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
})
