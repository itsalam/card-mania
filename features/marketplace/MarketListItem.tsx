import { FeaturedListing } from '@/client/marketplace'
import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { ItemListView } from '@/features/tcg-card-views/ListCard'
import { DisplayData } from '@/features/tcg-card-views/types'
import { useRouter } from 'expo-router'
import { Store } from 'lucide-react-native'
import React, { useMemo } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export type MarketListItemData = FeaturedListing & { id: string }

export function MarketListItem({ item }: { item: MarketListItemData }) {
  const router = useRouter()
  const sellerHandle = item.seller_username ?? item.seller_display_name ?? 'Unknown'
  const sellerInitial = sellerHandle.charAt(0).toUpperCase()
  const isGraded = Boolean(item.grading_company) && item.price_key !== 'ungraded'

  const displayData: DisplayData = useMemo(
    () => ({
      id: item.id,
      imageId: item.ref_id,
      title: item.name ?? 'Unknown Card',
      subHeading: item.set_name ?? undefined,
      displayPrice: item.market_value ? item.market_value / 100 : null,
      imageProxyArgs: {
        variant: 'tiny',
        shape: 'card',
        cardId: item.ref_id,
        imageType: 'front',
      },
    }),
    [item]
  )

  return (
    <ItemListView
      item={{ id: item.ref_id }}
      displayData={displayData}
      imageAccessory={null}
      renderAccessories={() => (
        <View className="self-stretch flex-1 flex flex-col items-stretch justify-between px-4 relative">
          <View className="flex-1 flex flex-col justify-start gap-2">
            {/* Grade chips */}
            {isGraded && (
              <View style={styles.gradeRow}>
                <View style={styles.gradeChip}>
                  <Text style={styles.gradeChipText}>{item.grading_company}</Text>
                </View>
                <View style={[styles.gradeChip, styles.gradeChipAccent]}>
                  <Text style={[styles.gradeChipText, styles.gradeChipAccentText]}>
                    {item.price_key}
                  </Text>
                </View>
              </View>
            )}

            {/* Price */}
            <Text className="text-4xl font-bold" style={{ color: Colors.$textDefault }}>
              {formatPrice(item.market_value)}
            </Text>
          </View>

          {/* Seller pill */}
          <TouchableOpacity
            style={styles.sellerPill}
            onPress={() => router.push(`/storefront/${item.seller_username}` as any)}
            activeOpacity={0.75}
          >
            <Avatar alt={sellerHandle} size="xs" style={styles.sellerAvatar}>
              <AvatarImage source={{ uri: item.seller_avatar_url ?? undefined }} />
              <AvatarFallback>
                <AvatarFallbackText>{sellerInitial}</AvatarFallbackText>
              </AvatarFallback>
            </Avatar>
            <Text style={styles.sellerHandle} numberOfLines={1}>
              @{sellerHandle}
            </Text>
            <View style={styles.pillDivider} />
            <View style={styles.storeIcon}>
              <Store size={13} color={Colors.$backgroundPrimaryHeavy} />
            </View>
          </TouchableOpacity>
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  // Grade chips
  gradeRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  gradeChip: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.1),
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.25),
  },
  gradeChipAccent: {
    backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.15),
    borderColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.4),
  },
  gradeChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: Colors.$textNeutral,
    textTransform: 'uppercase',
  },
  gradeChipAccentText: {
    color: Colors.$backgroundPrimaryHeavy,
  },

  // Seller pill
  sellerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.25),
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.06),
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 6,
    gap: 6,
    marginBottom: 4,
  },
  sellerAvatar: {
    // Avatar size="xs" is already small; no override needed
  },
  sellerHandle: {
    fontSize: 12,
    color: Colors.$textNeutral,
    flexShrink: 1,
  },
  pillDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
    marginVertical: 2,
  },
  storeIcon: {
    padding: 2,
  },
})
