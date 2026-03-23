import { useMyOffers } from '@/client/offers'
import { Offer, OfferStatus } from '@/client/offers/types'
import { Button } from '@/components/ui/button'
import { SearchBar } from '@/components/ui/search'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { BuyerOfferCard } from '@/features/offers/buyer-history'
import { InboxOfferCard } from '@/features/offers/index'
import { useProfiles } from '@/features/users/client/load-user'
import { useRef, useState } from 'react'
import {
  Dimensions,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'

type ViewFilter = 'inbox' | 'my-offers'
type StatusFilter = 'all' | OfferStatus
type SortOption = 'newest' | 'oldest' | 'amount-asc' | 'amount-desc'

const VIEW_FILTERS: { value: ViewFilter; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'my-offers', label: 'My Offers' },
]

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'amount-asc', label: 'Amount ↑' },
  { value: 'amount-desc', label: 'Amount ↓' },
]

function sortOffers(offers: Offer[], sort: SortOption): Offer[] {
  return [...offers].sort((a, b) => {
    switch (sort) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'amount-asc':
        return a.total_amount - b.total_amount
      case 'amount-desc':
        return b.total_amount - a.total_amount
    }
  })
}

export default function OffersRoute() {
  const [view, setView] = useState<ViewFilter>('inbox')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortOption>('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortModalVisible, setSortModalVisible] = useState(false)
  const [sortButtonLayout, setSortButtonLayout] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const sortButtonRef = useRef<View>(null)
  const insets = useSafeAreaInsets()

  const tabWidths = useRef<number[]>([])
  const indicatorX = useSharedValue(0)
  const indicatorWidth = useSharedValue(0)

  const indicatorStyle = useAnimatedStyle(() => ({
    left: indicatorX.value,
    width: indicatorWidth.value,
  }))

  function handleTabLayout(index: number, e: LayoutChangeEvent) {
    tabWidths.current[index] = e.nativeEvent.layout.width
    if (index === 0 && indicatorWidth.value === 0) {
      indicatorWidth.value = e.nativeEvent.layout.width
    }
  }

  function selectView(value: ViewFilter) {
    setView(value)
    const idx = VIEW_FILTERS.findIndex((f) => f.value === value)
    const x = tabWidths.current.slice(0, idx).reduce((s, w) => s + w, 0)
    const w = tabWidths.current[idx] ?? 0
    const spring = { damping: 24, stiffness: 300, mass: 0.6 }
    indicatorX.value = withSpring(x, spring)
    indicatorWidth.value = withSpring(w, spring)
  }

  const { data: inboxOffers, isLoading: inboxLoading } = useMyOffers('seller')
  const { data: myOffers, isLoading: myOffersLoading } = useMyOffers('buyer')

  const isLoading = view === 'inbox' ? inboxLoading : myOffersLoading
  const baseOffers = view === 'inbox' ? (inboxOffers ?? []) : (myOffers ?? [])

  // Collect all unique counterparty IDs from both lists so the profile cache
  // is warm regardless of which tab the user is on.
  const allOffers = [...(inboxOffers ?? []), ...(myOffers ?? [])]
  const counterpartyIds = [
    ...new Set(allOffers.flatMap((o) => [o.buyer_id, o.seller_id])),
  ]
  const { data: profiles = {} } = useProfiles(counterpartyIds)

  const query = searchQuery.trim().toLowerCase()
  const filtered = sortOffers(
    baseOffers.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (!query) return true

      // card title (snapshot stored on offer item at offer time)
      const itemMatch = (o.offer_items ?? []).some((item) =>
        (item.card_snapshot?.title ?? '').toLowerCase().includes(query)
      )

      // buyer note
      const noteMatch = (o.buyer_note ?? '').toLowerCase().includes(query)

      // counterparty display name or username (resolved from user_profile)
      const counterpartyId = view === 'inbox' ? o.buyer_id : o.seller_id
      const profile = profiles[counterpartyId]
      const nameMatch =
        (profile?.display_name ?? '').toLowerCase().includes(query) ||
        (profile?.username ?? '').toLowerCase().includes(query)

      return itemMatch || noteMatch || nameMatch
    }),
    sort
  )

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label ?? 'Newest'

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header row */}
      <View style={styles.header}>
        <Text variant="h1" style={styles.headerTitle}>
          Offers
        </Text>
      </View>

      {/* View filter tabs */}
      <View
        style={[
          styles.tapRow,
          {
            borderBottomColor: Colors.$outlineNeutral,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        {VIEW_FILTERS.map((f, idx) => (
          <Pressable
            key={f.value}
            style={[
              styles.tab,
              {
                backgroundColor:
                  view === f.value ? Colors.$backgroundElevatedLight : Colors.$backgroundElevated,
              },
            ]}
            onLayout={(e) => handleTabLayout(idx, e)}
            onPress={() => selectView(f.value)}
          >
            <Text
              style={[
                styles.tabText,
                view === f.value
                  ? { color: Colors.$textPrimary, fontWeight: '600' }
                  : { color: Colors.$textNeutral },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
        <Animated.View
          style={[styles.tabIndicator, { backgroundColor: Colors.$textPrimary }, indicatorStyle]}
        />
      </View>

      {/* Status filter chips */}
      <View style={styles.filterContents}>
        <SearchBar
          placeholder="Search offers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          customRightElement={
            <Pressable
              ref={sortButtonRef}
              style={styles.sortButton}
              onPress={() => {
                sortButtonRef.current?.measureInWindow((x, y, width, height) => {
                  setSortButtonLayout({ x, y, width, height })
                  setSortModalVisible(true)
                })
              }}
            >
              <Text style={[styles.sortLabel, { color: Colors.$textNeutral }]}>
                {currentSortLabel}
              </Text>
              <Text style={[styles.sortChevron, { color: Colors.$textNeutral }]}>›</Text>
            </Pressable>
          }
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContainer}
          style={styles.chipRow}
        >
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? 'primary' : 'outline'}
              onPress={() => setStatusFilter(f.value)}
              style={styles.chip}
            >
              <Text style={statusFilter === f.value ? styles.chipTextActive : styles.chipText}>
                {f.label}
              </Text>
            </Button>
          ))}
        </ScrollView>
      </View>

      {/* Offer list */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState hasQuery={!!query} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((offer) =>
            view === 'inbox' ? (
              <InboxOfferCard key={offer.id} offer={offer} />
            ) : (
              <BuyerOfferCard key={offer.id} offer={offer} />
            )
          )}
        </ScrollView>
      )}

      {/* Sort modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSortModalVisible(false)}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: Colors.$backgroundElevated,
                borderColor: Colors.$outlineNeutral,
                ...(sortButtonLayout && {
                  position: 'absolute',
                  top: sortButtonLayout.y + sortButtonLayout.height + 4,
                  right:
                    Dimensions.get('window').width - sortButtonLayout.x - sortButtonLayout.width,
                }),
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: Colors.$textDefault }]}>Sort by</Text>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  sort === option.value && {
                    backgroundColor: Colors.$backgroundPrimaryHeavy,
                  },
                ]}
                onPress={() => {
                  setSort(option.value)
                  setSortModalVisible(false)
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: Colors.$textDefault },
                    sort === option.value && { fontWeight: '600' },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

function EmptyState({ hasQuery }: { hasQuery?: boolean }) {
  return (
    <View style={styles.empty}>
      <Text variant="h3" style={[styles.emptyTitle, { color: Colors.$textNeutral }]}>
        No offers
      </Text>
      <Text variant="default" style={[styles.emptySubtitle, { color: Colors.$textNeutral }]}>
        {hasQuery ? 'No offers match your search.' : 'No offers match the current filters.'}
      </Text>
    </View>
  )
}

function LoadingSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} style={styles.skeletonCard} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 12,
  },
  headerTitle: {
    fontWeight: '700',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sortLabel: {
    fontSize: 14,
  },
  sortChevron: {
    fontSize: 18,
    lineHeight: 20,
  },
  chipRow: {
    flexGrow: 0,
    overflow: 'visible',
  },
  chipRowContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    // compact, no flex:1
  },
  chipText: {
    fontSize: 13,
  },
  chipTextActive: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  skeletonCard: {
    height: 120,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalTitle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  modalOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalOptionText: {
    fontSize: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    fontSize: 14,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  tapRow: {
    flexDirection: 'row',
    position: 'relative',
  },
  filterContents: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'visible',
    gap: 12,
  },
})
