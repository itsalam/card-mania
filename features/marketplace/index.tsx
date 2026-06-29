import { useFeaturedListings, usePublicStorefronts } from '@/client/marketplace'
import { CARD_ASPECT_RATIO } from '@/components/consts'
import { FadeScrollView } from '@/components/ui/fade-scroll'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { useRefresh } from '@/lib/hooks/useRefresh'
import {
  Columns2,
  Grid2x2,
  LayoutGrid,
  LayoutList,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react-native'
import React, { useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
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
type GradingFilter = 'all' | 'graded' | 'ungraded'

type MarketFilters = {
  genres: string[]
  sets: string[]
  grading: GradingFilter
}

const DEFAULT_FILTERS: MarketFilters = { genres: [], sets: [], grading: 'all' }

const VIEW_MODES: { mode: ViewMode; Icon: React.ComponentType<any> }[] = [
  { mode: 'compact', Icon: LayoutGrid },
  { mode: 'gallery', Icon: Columns2 },
  { mode: 'grid', Icon: Grid2x2 },
  { mode: 'list', Icon: LayoutList },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyFilters(items: FeaturedCardItem[], filters: MarketFilters): FeaturedCardItem[] {
  let result = items
  if (filters.genres.length > 0) {
    result = result.filter((l) => l.genre != null && filters.genres.includes(l.genre))
  }
  if (filters.sets.length > 0) {
    result = result.filter((l) => l.set_name != null && filters.sets.includes(l.set_name))
  }
  if (filters.grading === 'graded') {
    result = result.filter((l) => l.grading_company !== null)
  } else if (filters.grading === 'ungraded') {
    result = result.filter((l) => l.grading_company === null)
  }
  return result
}

function activeFilterCount(filters: MarketFilters): number {
  return (
    (filters.genres.length > 0 ? 1 : 0) +
    (filters.sets.length > 0 ? 1 : 0) +
    (filters.grading !== 'all' ? 1 : 0)
  )
}

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

function SectionEmpty({ message }: { message: string }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

function CardRowSkeleton({ mode }: { mode: ViewMode }) {
  const cardWidth = mode === 'compact' ? COMPACT_CARD_WIDTH : GALLERY_CARD_WIDTH
  const cardHeight = Math.round(cardWidth / CARD_ASPECT_RATIO)
  return (
    <ScrollView
      horizontal
      scrollEnabled={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
      style={{ height: cardHeight, marginBottom: 16 }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} style={{ width: cardWidth, height: cardHeight, borderRadius: 8 }} />
      ))}
    </ScrollView>
  )
}

function GridSkeleton() {
  const { width: windowWidth } = useWindowDimensions()
  const cellWidth = Math.floor((windowWidth - 32 - 24 - 8) / 2)
  const cellHeight = Math.round(cellWidth / CARD_ASPECT_RATIO)
  return (
    <View style={{ padding: 12, gap: 8 }}>
      {[0, 1].map((row) => (
        <View key={row} style={{ flexDirection: 'row', gap: 8 }}>
          {[0, 1].map((col) => (
            <Skeleton
              key={col}
              style={{ width: cellWidth, height: cellHeight, borderRadius: 10 }}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

function ListSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 0 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i}>
          {i > 0 && (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.25),
                marginVertical: 10,
              }}
            />
          )}
          <Skeleton style={{ height: 80, borderRadius: 10 }} />
        </View>
      ))}
    </View>
  )
}

function SectionSkeleton({ mode }: { mode: ViewMode }) {
  if (mode === 'grid') return <GridSkeleton />
  if (mode === 'list') return <ListSkeleton />
  return <CardRowSkeleton mode={mode} />
}

function SectionItems({ items, mode }: { items: FeaturedCardItem[]; mode: ViewMode }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()

  if (mode === 'grid') {
    const cellWidth = Math.floor((windowWidth - 32 - 24 - 8) / 2)
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

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Filter modal ──────────────────────────────────────────────────────────────

function MarketFilterModal({
  visible,
  onDismiss,
  filters,
  allGenres,
  allSets,
  onChange,
  onReset,
}: {
  visible: boolean
  onDismiss: () => void
  filters: MarketFilters
  allGenres: string[]
  allSets: string[]
  onChange: (f: MarketFilters) => void
  onReset: () => void
}) {
  const insets = useSafeAreaInsets()
  const [setSearch, setSetSearch] = useState('')

  const GRADING_OPTIONS: { label: string; value: GradingFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Graded', value: 'graded' },
    { label: 'Ungraded', value: 'ungraded' },
  ]

  // Visible sets: toggled ones always shown; search results shown when query is non-empty
  const visibleSets = useMemo(() => {
    const q = setSearch.trim().toLowerCase()
    if (!q) return filters.sets
    const matches = allSets.filter((s) => s.toLowerCase().includes(q))
    // merge: search results first, then any toggled sets not in the results
    const extra = filters.sets.filter((s) => !matches.includes(s))
    return [...matches, ...extra]
  }, [setSearch, allSets, filters.sets])

  function toggleGenre(genre: string) {
    const next = filters.genres.includes(genre)
      ? filters.genres.filter((g) => g !== genre)
      : [...filters.genres, genre]
    onChange({ ...filters, genres: next })
  }

  function toggleSet(set: string) {
    const next = filters.sets.includes(set)
      ? filters.sets.filter((s) => s !== set)
      : [...filters.sets, set]
    onChange({ ...filters, sets: next })
  }

  function handleDismiss() {
    setSetSearch('')
    onDismiss()
  }

  function handleReset() {
    setSetSearch('')
    onReset()
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={handleDismiss}>
      <Pressable style={styles.modalBackdrop} onPress={handleDismiss} />
      <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Thumb */}
        <View style={styles.filterThumbRow}>
          <View style={styles.filterThumb} />
        </View>

        {/* Header */}
        <View style={styles.filterHeader}>
          <Text variant="h4" style={{ fontWeight: '700' }}>
            Filters
          </Text>
          <TouchableOpacity onPress={handleReset} activeOpacity={0.75} style={styles.resetBtn}>
            <RotateCcw size={14} color={Colors.$textNeutral} />
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Grading */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Grading</Text>
            <View style={styles.filterChipRow}>
              {GRADING_OPTIONS.map(({ label, value }) => (
                <FilterChip
                  key={value}
                  label={label}
                  active={filters.grading === value}
                  onPress={() => onChange({ ...filters, grading: value })}
                />
              ))}
            </View>
          </View>

          {/* Sport / Genre */}
          {allGenres.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Sport</Text>
              <View style={styles.filterChipRow}>
                {allGenres.map((genre) => (
                  <FilterChip
                    key={genre}
                    label={genre}
                    active={filters.genres.includes(genre)}
                    onPress={() => toggleGenre(genre)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Set — searchable */}
          {allSets.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Set</Text>
              <View style={styles.setSearchRow}>
                <Search size={14} color={Colors.$textNeutral} style={{ flexShrink: 0 }} />
                <TextInput
                  style={styles.setSearchInput}
                  placeholder="Search sets…"
                  placeholderTextColor={Colors.$textNeutralLight}
                  value={setSearch}
                  onChangeText={setSetSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {setSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setSetSearch('')} hitSlop={8}>
                    <X size={14} color={Colors.$textNeutral} />
                  </TouchableOpacity>
                )}
              </View>

              {visibleSets.length > 0 ? (
                <View style={styles.filterChipRow}>
                  {visibleSets.map((set) => (
                    <FilterChip
                      key={set}
                      label={set}
                      active={filters.sets.includes(set)}
                      onPress={() => toggleSet(set)}
                    />
                  ))}
                </View>
              ) : setSearch.length > 0 ? (
                <Text style={[styles.emptyText, { marginTop: 10 }]}>
                  No sets match &quot;{setSearch}&quot;
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>

        {/* Apply */}
        <TouchableOpacity style={styles.applyBtn} onPress={handleDismiss} activeOpacity={0.82}>
          <Text style={styles.applyBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets()
  const [viewMode, setViewMode] = useState<ViewMode>('gallery')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_FILTERS)

  const {
    data: rawListings = [],
    isLoading,
    error,
    refetch: refetchListings,
  } = useFeaturedListings()
  const { data: storefronts = [], refetch: refetchStorefronts } = usePublicStorefronts()
  const { refreshing, onRefresh } = useRefresh([refetchListings, refetchStorefronts])

  const allListings: FeaturedCardItem[] = useMemo(
    () => rawListings.map((l) => ({ ...l, id: l.collection_item_id })),
    [rawListings]
  )

  const allGenres = useMemo(
    () => Array.from(new Set(allListings.map((l) => l.genre).filter(Boolean) as string[])).sort(),
    [allListings]
  )

  const allSets = useMemo(
    () =>
      Array.from(new Set(allListings.map((l) => l.set_name).filter(Boolean) as string[]))
        .sort()
        .slice(0, 12),
    [allListings]
  )

  const listings = useMemo(() => applyFilters(allListings, filters), [allListings, filters])
  const graded = useMemo(() => listings.filter((l) => l.grading_company !== null), [listings])
  const sealed = useMemo(() => listings.filter((l) => l.item_kind !== 'card'), [listings])

  const filterCount = activeFilterCount(filters)

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.headerTitle}>Market</Text>
          <Text style={styles.headerSubtitle}>
            {isLoading
              ? 'Loading…'
              : `${listings.length} listing${listings.length !== 1 ? 's' : ''} · ${storefronts.length} seller${storefronts.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <TouchableOpacity
            style={styles.filterButton}
            activeOpacity={0.7}
            onPress={() => setFilterOpen(true)}
          >
            <SlidersHorizontal size={16} color={Colors.$iconDefault} />
            {filterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Error ── */}
      {error && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>
            {String((error as any)?.message ?? 'Something went wrong')}
          </Text>
          <TouchableOpacity
            onPress={() => refetchListings()}
            activeOpacity={0.75}
            style={styles.retryBtn}
          >
            <RotateCcw size={13} color={Colors.$textDefault} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
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
          {isLoading ? (
            <SectionSkeleton mode={viewMode} />
          ) : listings.length === 0 ? (
            <SectionEmpty
              message={
                filterCount > 0
                  ? 'No listings match your filters.'
                  : 'No listings available right now.'
              }
            />
          ) : (
            <SectionItems items={listings} mode={viewMode} />
          )}
        </CardContainer>

        {/* Auctions · Graded */}
        {(isLoading || graded.length > 0) && (
          <CardContainer>
            <SectionHeader label="Auctions · Graded" count={graded.length} />
            {isLoading ? (
              <SectionSkeleton mode={viewMode} />
            ) : graded.length === 0 ? (
              <SectionEmpty message="No graded listings match your filters." />
            ) : (
              <SectionItems items={graded} mode={viewMode} />
            )}
          </CardContainer>
        )}

        {/* Auctions · Sealed */}
        {(isLoading || sealed.length > 0) && (
          <CardContainer>
            <SectionHeader label="Auctions · Sealed" count={sealed.length} />
            {isLoading ? (
              <SectionSkeleton mode={viewMode} />
            ) : sealed.length === 0 ? (
              <SectionEmpty message="No sealed listings match your filters." />
            ) : (
              <SectionItems items={sealed} mode={viewMode} />
            )}
          </CardContainer>
        )}
      </ScrollView>

      {/* ── Filter Modal ── */}
      <MarketFilterModal
        visible={filterOpen}
        onDismiss={() => setFilterOpen(false)}
        filters={filters}
        allGenres={allGenres}
        allSets={allSets}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'left',
    color: Colors.$textDefault,
  },
  headerSubtitle: { color: Colors.$textNeutral, fontSize: 13 },

  filterButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.08),
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.2),
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.$backgroundPrimaryHeavy,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.$backgroundDefault,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 11,
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

  // Error row
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: Colors.$textDanger,
    fontSize: 13,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.08),
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.2),
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.$textDefault,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.$textNeutral,
    textAlign: 'center',
  },

  // Filter chips
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.08),
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.25),
  },
  filterChipActive: {
    backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.2),
    borderColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.5),
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.$textNeutral,
  },
  filterChipTextActive: {
    color: Colors.$backgroundPrimaryHeavy,
    fontWeight: '600',
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },

  setSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.3),
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.06),
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  setSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.$textDefault,
    padding: 0,
  },

  // Filter modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.rgba(Colors.$backgroundNeutralIdle, 0.5),
  },
  filterSheet: {
    backgroundColor: Colors.$backgroundDefault,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.15),
  },
  filterThumbRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  filterThumb: {
    width: '15%',
    height: 4,
    borderRadius: 10,
    backgroundColor: Colors.rgba(Colors.$backgroundNeutralIdle, 0.8),
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.$textNeutral,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.08),
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.2),
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.$textNeutral,
  },
  applyBtn: {
    marginTop: 8,
    alignSelf: 'stretch',
    backgroundColor: Colors.$backgroundPrimaryHeavy,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
})
