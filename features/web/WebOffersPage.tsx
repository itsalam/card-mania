import { useMyOffers } from '@/client/offers'
import { Offer, OfferStatus } from '@/client/offers/types'
import { ChipRowContainer, ToggleBadge } from '@/components/ui/badge'
import { SearchBar } from '@/components/ui/search'
import { Text } from '@/components/ui/text/base-text'
import { BuyerOfferCard } from '@/features/offers/buyer-history'
import { InboxOfferCard } from '@/features/offers/index'
import { SkeletonCard } from '@/features/offers/ui'
import { useProfiles } from '@/features/users/client/load-user'
import { useRefresh } from '@/lib/hooks/useRefresh'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, X } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { GradientBackground } from '@/components/Background'
import { useWebUser } from './hooks/useWebUser'
import { NAV_CLEARANCE, NAV_TOP } from './layout-constants'
import { WebNav } from './WebNav'
import { AuthModal } from './AuthModal'

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
  { value: 'completed', label: 'Completed' },
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

export default function WebOffersPage() {
  const currentUser = useWebUser()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [navQuery, setNavQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [view, setView] = useState<ViewFilter>('inbox')
  const [activeStatuses, setActiveStatuses] = useState<Set<OfferStatus>>(new Set())
  const [sort, setSort] = useState<SortOption>('newest')
  const [searchQuery, setSearchQuery] = useState('')

  const { width } = useWindowDimensions()
  const isPortrait = width < 768

  const {
    data: inboxOffers,
    isLoading: inboxLoading,
    refetch: refetchInbox,
  } = useMyOffers('seller')
  const {
    data: myOffers,
    isLoading: myOffersLoading,
    refetch: refetchMyOffers,
  } = useMyOffers('buyer')
  const { refreshing, onRefresh } = useRefresh([refetchInbox, refetchMyOffers])

  const allOffers = [...(inboxOffers ?? []), ...(myOffers ?? [])]
  const counterpartyIds = [...new Set(allOffers.flatMap((o) => [o.buyer_id, o.seller_id]))]
  const { data: profiles = {} } = useProfiles(counterpartyIds)

  const isLoading = view === 'inbox' ? inboxLoading : myOffersLoading
  const baseOffers = view === 'inbox' ? (inboxOffers ?? []) : (myOffers ?? [])
  const query = searchQuery.trim().toLowerCase()

  const filtered = sortOffers(
    baseOffers.filter((o) => {
      if (activeStatuses.size > 0 && !activeStatuses.has(o.status as OfferStatus)) return false
      if (!query) return true
      const itemMatch = (o.offer_items ?? []).some((item) =>
        (item.card_snapshot?.title ?? '').toLowerCase().includes(query)
      )
      const noteMatch = (o.buyer_note ?? '').toLowerCase().includes(query)
      const counterpartyId = view === 'inbox' ? o.buyer_id : o.seller_id
      const profile = profiles[counterpartyId]
      const nameMatch =
        (profile?.display_name ?? '').toLowerCase().includes(query) ||
        (profile?.username ?? '').toLowerCase().includes(query)
      return itemMatch || noteMatch || nameMatch
    }),
    sort
  )

  if (!currentUser) {
    return (
      <GradientBackground style={{ flex: 1 }}>
        <WebNav
          currentUser={null}
          scrolled={scrolled}
          onSignInPress={() => setShowAuthModal(true)}
        />
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text variant="h2">Sign in to view offers</Text>
          <Pressable
            onPress={() => setShowAuthModal(true)}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: Colors.$backgroundPrimaryHeavy,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Sign in</Text>
          </Pressable>
        </View>
      </GradientBackground>
    )
  }

  return (
    <GradientBackground style={{ flex: 1 }}>
      <WebNav
        currentUser={currentUser}
        scrolled={scrolled}
        searchQuery={navQuery}
        onSearchChange={setNavQuery}
        onSignInPress={() => setShowAuthModal(true)}
      />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: isPortrait ? 8 : NAV_CLEARANCE + NAV_TOP,
          paddingBottom: 40,
        }}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 10)}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View
          style={{
            maxWidth: 720,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: 16,
            gap: 16,
          }}
        >
          {/* Title */}
          <Text variant="h1" style={{ fontSize: 28, fontWeight: '700', paddingTop: 8 }}>
            Offers
          </Text>

          {/* View tabs + sort toggle on same row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                borderWidth: 1,
                borderColor: Colors.$outlineNeutral,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {VIEW_FILTERS.map((f) => (
                <Pressable
                  key={f.value}
                  onPress={() => setView(f.value)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    backgroundColor:
                      view === f.value ? Colors.$backgroundPrimaryHeavy : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontWeight: view === f.value ? '600' : '400',
                      color: view === f.value ? '#fff' : Colors.$textNeutral,
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Sort — dropdown in portrait, segmented in landscape */}
            {isPortrait ? (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      borderWidth: 1,
                      borderColor: Colors.$outlineNeutral,
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: Colors.$textNeutral }}>
                      {SORT_OPTIONS.find((o) => o.value === sort)?.label}
                    </Text>
                    <ChevronDown size={12} color={Colors.$textNeutralLight} />
                  </View>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SORT_OPTIONS.map((opt) => (
                    <DropdownMenuItem key={opt.value} onPress={() => setSort(opt.value)}>
                      <Text
                        style={{ fontSize: 14, fontWeight: sort === opt.value ? '600' : '400' }}
                      >
                        {opt.label}
                      </Text>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  borderWidth: 1,
                  borderColor: Colors.$outlineNeutral,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSort(opt.value)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      backgroundColor:
                        sort === opt.value ? Colors.$backgroundPrimaryHeavy : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: sort === opt.value ? '600' : '400',
                        color: sort === opt.value ? '#fff' : Colors.$textNeutralLight,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Search */}
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search offers…"
            hideSideButton
          />

          {/* Status chips */}
          <ChipRowContainer label="Statuses">
            {STATUS_FILTERS.map((f) => (
              <ToggleBadge
                key={f.value}
                label={f.label}
                checked={
                  f.value === 'all'
                    ? activeStatuses.size === 0
                    : activeStatuses.has(f.value as OfferStatus)
                }
                onPress={() => {
                  if (f.value === 'all') {
                    setActiveStatuses(new Set())
                    return
                  }
                  setActiveStatuses((prev) => {
                    const next = new Set(prev)
                    if (next.has(f.value as OfferStatus)) next.delete(f.value as OfferStatus)
                    else next.add(f.value as OfferStatus)
                    return next
                  })
                }}
                rightElement={
                  f.value !== 'all' && activeStatuses.has(f.value as OfferStatus) ? (
                    <X size={14} color={Colors.$textDefault} strokeWidth={3} />
                  ) : null
                }
              />
            ))}
          </ChipRowContainer>

          {/* List */}
          <View style={{ gap: 12 }}>
            {isLoading ? (
              [0, 1, 2].map((i) => <SkeletonCard key={i} />)
            ) : filtered.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Text variant="muted">
                  {query ? 'No offers match your search.' : 'No offers yet.'}
                </Text>
              </View>
            ) : (
              filtered.map((offer) =>
                view === 'inbox' ? (
                  <InboxOfferCard key={offer.id} offer={offer} />
                ) : (
                  <BuyerOfferCard key={offer.id} offer={offer} />
                )
              )
            )}
          </View>
        </View>
      </ScrollView>
    </GradientBackground>
  )
}
