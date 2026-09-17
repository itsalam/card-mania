import { HomeFeedSectionConfig } from '@/client/home/sections'
import { useExpandableSection } from '@/components/content-card'
import { Text } from '@/components/ui/text/base-text'
import { useFollowedSellerIds, useToggleSellerFollow } from '@/features/users/client/follow'
import { PublicProfile, useSellers } from '@/features/users/client/load-user'
import { UserContact } from '@/features/users/components/UserAvatars'
import { useRouter } from 'expo-router'
import { Users } from 'lucide-react-native'
import React from 'react'
import { Pressable, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { HOME_FEED_SECTION_ICONS } from '../sectionIcons'

// Another 1.3x pass on top of the original 92→120 — now that name/handle are capped to one
// line each (ellipsis-truncated, not wrapped), a wider card shows more of the name/handle
// before truncating.
const DEFAULT_ITEM_WIDTH = 120

// Matches CollectionsListItem's collapsed rounded-card treatment (features/collection/
// components/ListItem.tsx) — the padded box is bigger than the raw content, so this is added
// on top of itemWidth when sizing both the card and the rail's snap interval, not squeezed out
// of it.
const COLLAPSED_CARD_PADDING = 12

// Fixed, not auto-measured: outline avatar (~40) + gap(8) + 1-line name (~24) + gap(1) +
// 1-line handle (~24) + Follow button incl. its own marginTop (~30) + this card's own padding
// (24) ≈ 151 — now that name/handle are capped to one line, retuned tighter than the earlier
// 200 (which budgeted for up to 2 wrapped lines each).
const COLLAPSED_CARD_HEIGHT = 160

type SellerRow = { id: string; seller: PublicProfile | undefined }

// Toggle-style press: flip happens in useToggleSellerFollow's onMutate the instant `mutate`
// is called, so reading isFollowing straight off the shared query already reflects the tap —
// see CLAUDE.md's toggle-state interaction convention.
function FollowButton({ sellerId, isFollowing }: { sellerId: string; isFollowing: boolean }) {
  const { mutate, isPending } = useToggleSellerFollow()
  return (
    <Pressable
      hitSlop={6}
      disabled={isPending}
      onPress={(e) => {
        e.stopPropagation()
        mutate(sellerId)
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: isFollowing ? 'transparent' : Colors.rgba(Colors.$outlineNeutral, 0.4),
        backgroundColor: isFollowing
          ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35)
          : Colors.rgba(Colors.$backgroundDefault, 0.92),
      }}
    >
      <Text variant="stats" style={{ color: Colors.$textDefault }}>
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  )
}

export function useSuggestedSellersSection(config?: HomeFeedSectionConfig) {
  const limit = config?.result_limit ?? 10
  // Layout (itemWidth) intentionally ignores config.layout for now — the stored DB row still
  // has the old pre-resize values (itemWidth: 92, from before the 1.3x passes), and since those
  // are non-null they'd always win over DEFAULT_ITEM_WIDTH via `??`. Using the local constant
  // directly until the DB config is updated to match.
  const itemWidth = DEFAULT_ITEM_WIDTH
  const { data: sellers = [], isLoading } = useSellers(limit)
  const { data: followedIds } = useFollowedSellerIds()
  const router = useRouter()

  const rows: SellerRow[] = isLoading
    ? Array.from({ length: Math.min(limit, 4) }, (_, i) => ({
        id: `skeleton-${i}`,
        seller: undefined,
      }))
    : sellers.map((s) => ({ id: s.user_id, seller: s }))

  // useExpandableSection is still called below (unconditionally, per Rules of Hooks) even when
  // there's nothing to show — only the *result* is swapped out here, matching the old early
  // `return null` this component used before it became a hook FeedPage calls unconditionally.
  const isEmpty = !isLoading && rows.length === 0

  const section = useExpandableSection({
    icon: (config && HOME_FEED_SECTION_ICONS[config.icon]) ?? Users,
    title: config?.title ?? 'Suggested Sellers',
    itemWidth: itemWidth + COLLAPSED_CARD_PADDING * 2,
    expandable: config?.layout.expandable ?? false,
    items: rows,
    renderItem: ({ item: { id, seller }, isOpen }) => {
      const isSkeleton = id.startsWith('skeleton')
      return (
        <Pressable
          disabled={isSkeleton}
          onPress={() => router.push(`/user/${id}` as any)}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View
            style={
              isOpen
                ? { width: '100%', paddingVertical: 8 }
                : {
                    width: itemWidth + COLLAPSED_CARD_PADDING * 2,
                    height: COLLAPSED_CARD_HEIGHT,
                    overflow: 'hidden',
                    alignItems: 'center',
                    backgroundColor: Colors.$backgroundNeutralLight,
                    borderRadius: 16,
                    padding: COLLAPSED_CARD_PADDING,
                    borderWidth: 1,
                    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
                  }
            }
          >
            <UserContact
              user={seller}
              fallbackId={id}
              variant={isOpen ? 'default' : 'outline'}
              size={isOpen ? 'md' : 'sm'}
              numberOfLines={1}
            >
              {!isSkeleton && (
                <FollowButton sellerId={id} isFollowing={followedIds?.has(id) ?? false} />
              )}
            </UserContact>
          </View>
        </Pressable>
      )
    },
  })

  return isEmpty ? { header: null, body: null, isOpen: false } : section
}
