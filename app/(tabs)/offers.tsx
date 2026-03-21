import { useMyOffers } from '@/client/offers'
import { Offer, OfferStatus } from '@/client/offers/types'
import { BuyerOfferCard } from '@/features/offers/buyer-history'
import { OfferCard } from '@/features/offers/index'
import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'

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
  const [sortModalVisible, setSortModalVisible] = useState(false)
  const insets = useSafeAreaInsets()

  const { data: inboxOffers, isLoading: inboxLoading } = useMyOffers('seller')
  const { data: myOffers, isLoading: myOffersLoading } = useMyOffers('buyer')

  const isLoading = view === 'inbox' ? inboxLoading : myOffersLoading
  const baseOffers = view === 'inbox' ? (inboxOffers ?? []) : (myOffers ?? [])

  const filtered = sortOffers(
    baseOffers.filter((o) => statusFilter === 'all' || o.status === statusFilter),
    sort
  )

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label ?? 'Newest'

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header row */}
      <View style={styles.header}>
        <Text variant="h2" style={styles.headerTitle}>
          Offers
        </Text>
        <Pressable style={styles.sortButton} onPress={() => setSortModalVisible(true)}>
          <Text style={[styles.sortLabel, { color: Colors.$textNeutral }]}>{currentSortLabel}</Text>
          <Text style={[styles.sortChevron, { color: Colors.$textNeutral }]}>›</Text>
        </Pressable>
      </View>

      {/* View filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {VIEW_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={view === f.value ? 'primary' : 'outline'}
            size="sm"
            onPress={() => setView(f.value)}
            style={styles.chip}
          >
            <Text style={view === f.value ? styles.chipTextActive : styles.chipText}>
              {f.label}
            </Text>
          </Button>
        ))}
      </ScrollView>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? 'primary' : 'outline'}
            size="sm"
            onPress={() => setStatusFilter(f.value)}
            style={styles.chip}
          >
            <Text style={statusFilter === f.value ? styles.chipTextActive : styles.chipText}>
              {f.label}
            </Text>
          </Button>
        ))}
      </ScrollView>

      {/* Offer list */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((offer) =>
            view === 'inbox' ? (
              <OfferCard key={offer.id} offer={offer} />
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
              { backgroundColor: Colors.$backgroundElevated, borderColor: Colors.$outlineNeutral },
            ]}
          >
            <Text variant="h3" style={[styles.modalTitle, { color: Colors.$textDefault }]}>
              Sort by
            </Text>
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

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text variant="h3" style={[styles.emptyTitle, { color: Colors.$textNeutral }]}>
        No offers
      </Text>
      <Text variant="default" style={[styles.emptySubtitle, { color: Colors.$textNeutral }]}>
        No offers match the current filters.
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
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
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
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
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  modalOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalOptionText: {
    fontSize: 14,
  },
})
