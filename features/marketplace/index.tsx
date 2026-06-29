import { useFeaturedListings, usePublicStorefronts } from '@/client/marketplace'
import { FadeScrollView } from '@/components/ui/fade-scroll'
import { Text } from '@/components/ui/text/base-text'
import { useRefresh } from '@/lib/hooks/useRefresh'
import { CARD_ASPECT_RATIO } from '@/components/consts'
import { Columns2, Grid2x2, LayoutGrid, LayoutList, SlidersHorizontal } from 'lucide-react-native'
import React, { useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { FeaturedCard, type FeaturedCardItem } from './FeaturedCard'
import { GridCard } from './GridCard'
import { MarketListItem } from './MarketListItem'
import { SellerCard } from './SellerCard'

const COMPACT_CARD_WIDTH = 80
const GALLERY_CARD_WIDTH = 120

type ViewMode = 'compact' | 'gallery' | 'grid' | 'list'

const VIEW_MODES: { mode: ViewMode; Icon: React.ComponentType<any> }[] = [
  { mode: 'compact', Icon: LayoutGrid },
  { mode: 'gallery', Icon: Columns2 },
  { mode: 'grid', Icon: Grid2x2 },
  { mode: 'list', Icon: LayoutList },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <View style={styles.toggle}>
      {VIEW_MODES.map(({ mode, Icon }) => {
        const active = value === mode
        return (
          <TouchableOpacity
            key={mode}
            onPress={() => onChange(mode)}
            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
            activeOpacity={0.7}
          >
            <Icon
              size={14}
              color={active ? Colors.$iconDefault : Colors.$iconNeutral}
              strokeWidth={active ? 2.5 : 2}
            />
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function CardContainer({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="h4" style={{ fontWeight: '700' }}>
          {label}
        </Text>
        {count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function SectionItems({ items, mode }: { items: FeaturedCardItem[]; mode: ViewMode }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()

  if (mode === 'grid') {
    // list paddingH:16×2 + section contentPadding:12×2 + column gap:8 → two equal cells
    const cellWidth = Math.floor((windowWidth - 32 - 24 - 8) / 2)
    // Chunk into pairs so each row is a plain row-direction View — flexWrap+gap
    // doesn't reliably place exactly 2 per row in RN's flex engine.
    const rows: FeaturedCardItem[][] = []
    for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2))
    return (
      <View style={styles.gridContent}>
        {rows.map((pair, rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            {pair.map((item) => (
              <GridCard key={item.id} item={item} width={cellWidth} />
            ))}
          </View>
        ))}
      </View>
    )
  }

  if (mode === 'list') {
    // Cap at ~42% of screen height so the section doesn't swallow the page.
    // key=cropHeight causes a remount on orientation/layout change, which resets
    // scroll position back to the top automatically.
    const cropHeight = Math.round(windowHeight * 0.42)
    return (
      <FadeScrollView
        key={cropHeight}
        nestedScrollEnabled
        style={{ maxHeight: cropHeight }}
        contentContainerStyle={styles.listContent}
      >
        {items.map((item, i) => (
          <View key={item.id}>
            {i > 0 && <View style={styles.listDivider} />}
            <MarketListItem item={item} />
          </View>
        ))}
      </FadeScrollView>
    )
  }

  const cardWidth = mode === 'compact' ? COMPACT_CARD_WIDTH : GALLERY_CARD_WIDTH
  // Explicit height prevents the CardContainer from retaining the taller list-mode
  // height when transitioning back to a horizontal layout.
  const cardHeight = Math.round(cardWidth / CARD_ASPECT_RATIO)

  return (
    <FadeScrollView
      horizontal
      contentContainerStyle={styles.scrollContent}
      style={{ height: cardHeight, marginBottom: 16 }}
    >
      {items.map((item) => (
        <FeaturedCard key={item.id} item={item} width={cardWidth} />
      ))}
    </FadeScrollView>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets()
  const [viewMode, setViewMode] = useState<ViewMode>('gallery')

  const { data: rawListings = [], error, refetch: refetchListings } = useFeaturedListings()
  const { data: storefronts = [], refetch: refetchStorefronts } = usePublicStorefronts()
  const { refreshing, onRefresh } = useRefresh([refetchListings, refetchStorefronts])

  const listings = rawListings.map((l) => ({ ...l, id: l.collection_item_id }))
  const graded = listings.filter((l) => l.grading_company !== null)
  const sealed = listings.filter((l) => l.item_kind !== 'card')

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="h1" style={styles.headerTitle}>
            Market
          </Text>
          <Text style={styles.headerSubtitle}>
            {listings.length} listing{listings.length !== 1 ? 's' : ''} · {storefronts.length}{' '}
            seller{storefronts.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
            <SlidersHorizontal size={16} color={Colors.$iconDefault} />
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ color: Colors.$textDanger, fontSize: 13 }}>
            {String((error as any)?.message ?? error)}
          </Text>
        </View>
      )}

      {/* ── Sections ── */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
      >
        {/* Top Sellers */}
        {storefronts.length > 0 && (
          <CardContainer>
            <View style={{ paddingTop: 16, paddingBottom: 12 }}>
              <Text
                variant="h4"
                style={{ fontWeight: '700', marginBottom: 14, paddingHorizontal: 16 }}
              >
                Top Sellers
              </Text>
              <FadeScrollView horizontal contentContainerStyle={{ gap: 16, paddingHorizontal: 16 }}>
                {storefronts.map((sf) => (
                  <SellerCard key={sf.storefront_id} storefront={sf} />
                ))}
              </FadeScrollView>
            </View>
          </CardContainer>
        )}

        {/* Featured */}
        <CardContainer>
          <SectionHeader label="Featured" count={listings.length} />
          <SectionItems items={listings} mode={viewMode} />
        </CardContainer>

        {/* Auctions · Graded */}
        {graded.length > 0 && (
          <CardContainer>
            <SectionHeader label="Auctions · Graded" count={graded.length} />
            <SectionItems items={graded} mode={viewMode} />
          </CardContainer>
        )}

        {/* Auctions · Sealed */}
        {sealed.length > 0 && (
          <CardContainer>
            <SectionHeader label="Auctions · Sealed" count={sealed.length} />
            <SectionItems items={sealed} mode={viewMode} />
          </CardContainer>
        )}
      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 32, fontWeight: '700' },
  headerSubtitle: { color: Colors.$textNeutral, fontSize: 13 },

  filterButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.08),
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.2),
  },

  // View mode pill toggle (matches CLAUDE.md toggle convention)
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
    padding: 6,
  },
  toggleBtnActive: {
    backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35),
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },

  card: {
    backgroundColor: Colors.$backgroundNeutral,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.15),
    overflow: 'hidden',
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },

  // Horizontal scroll modes
  scrollContainer: { paddingBottom: 16 },
  scrollContent: { gap: 12, paddingHorizontal: 16 },

  // Two-column grid mode
  gridContent: {
    padding: 12,
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },

  // List mode
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 0,
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.25),
    marginVertical: 10,
  },

  countBadge: {
    backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.15),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35),
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.$backgroundPrimaryHeavy,
  },
})
