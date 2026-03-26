import { useMyOffers } from '@/client/offers'
import { Offer, OfferStatus } from '@/client/offers/types'
import { TabRow } from '@/components/tabs/TabRow'
import { ChipRowContainer, ToggleBadge } from '@/components/ui/badge'
import { SearchBar } from '@/components/ui/search'
import { Text } from '@/components/ui/text/base-text'
import { BuyerOfferCard } from '@/features/offers/buyer-history'
import { InboxOfferCard } from '@/features/offers/index'
import { SkeletonCard } from '@/features/offers/ui'
import { useProfiles } from '@/features/users/client/load-user'
import { X } from 'lucide-react-native'
import { useRef, useState } from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'

type ViewFilter = 'inbox' | 'my-offers'
type SortOption = 'newest' | 'oldest' | 'amount-asc' | 'amount-desc'

const VIEW_FILTERS: { value: ViewFilter; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'my-offers', label: 'My Offers' },
]

const STATUS_FILTERS: { value: OfferStatus | 'all'; label: string }[] = [
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
  const [activeStatuses, setActiveStatuses] = useState<Set<OfferStatus>>(new Set())
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

  const { data: inboxOffers, isLoading: inboxLoading } = useMyOffers('seller')
  const { data: myOffers, isLoading: myOffersLoading } = useMyOffers('buyer')

  const isLoading = view === 'inbox' ? inboxLoading : myOffersLoading
  const baseOffers = view === 'inbox' ? (inboxOffers ?? []) : (myOffers ?? [])

  // Collect all unique counterparty IDs from both lists so the profile cache
  // is warm regardless of which tab the user is on.
  const allOffers = [...(inboxOffers ?? []), ...(myOffers ?? [])]
  const counterpartyIds = [...new Set(allOffers.flatMap((o) => [o.buyer_id, o.seller_id]))]
  const { data: profiles = {} } = useProfiles(counterpartyIds)

  const query = searchQuery.trim().toLowerCase()
  const filtered = sortOffers(
    baseOffers.filter((o) => {
      if (activeStatuses.size > 0 && !activeStatuses.has(o.status as OfferStatus)) return false
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header row */}
      <View style={styles.header}>
        <Text variant="h1" style={styles.headerTitle}>
          Offers
        </Text>
      </View>

      {/* View filter tabs */}
      <TabRow options={VIEW_FILTERS} onValueChange={setView} />

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
      </View>
      <ChipRowContainer label={'Statuses'}>
        {STATUS_FILTERS.map((f) => (
          <ToggleBadge
            key={f.value}
            onPress={() => {
              if (f.value === 'all') {
                setActiveStatuses(new Set())
              } else {
                setActiveStatuses((prev) => {
                  const next = new Set(prev)
                  if (next.has(f.value as OfferStatus)) {
                    next.delete(f.value as OfferStatus)
                  } else {
                    next.add(f.value as OfferStatus)
                  }
                  return next
                })
              }
            }}
            style={styles.chip}
            label={f.label}
            checked={
              f.value === 'all'
                ? activeStatuses.size === 0
                : activeStatuses.has(f.value as OfferStatus)
            }
            rightElement={
              f.value !== 'all' && activeStatuses.has(f.value) ? (
                <X
                  size={16}
                  color={Colors.$textDefault}
                  style={{ marginRight: 0, paddingRight: 0 }}
                  strokeWidth={3}
                />
              ) : null
            }
          />
        ))}
      </ChipRowContainer>
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
        <SkeletonCard key={i} />
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
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
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
  chip: {
    gap: 0,
    // paddingRight: 12,
    // marginRight: 12,
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

  filterContents: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 4,
    overflow: 'visible',
    gap: 12,
  },
})
