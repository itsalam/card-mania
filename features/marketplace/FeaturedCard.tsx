import { useImageProxy } from '@/client/image-proxy'
import { FeaturedListing } from '@/client/marketplace'
import { CARD_ASPECT_RATIO } from '@/components/consts'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '@/components/tcg-card/consts'
import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Text } from '@/components/ui/text/base-text'
import { formatPrice } from '@/components/utils'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

type FeaturedCardItem = FeaturedListing & { id: string }

function CardThumbnail({ item }: { item: FeaturedCardItem }) {
  const { data: imageData } = useImageProxy({
    variant: 'tiny',
    shape: 'card',
    cardId: item.ref_id,
    imageType: 'front',
  })

  const sellerHandle = item.seller_username ?? item.seller_display_name ?? '?'
  const sellerInitial = sellerHandle.charAt(0).toUpperCase()

  return (
    <View
      style={{
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        aspectRatio: CARD_ASPECT_RATIO,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: Colors.$backgroundElevated,
      }}
    >
      {imageData?.url ? (
        <Image source={{ uri: imageData.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.$backgroundElevated }]} />
      )}

      {/* Price badge */}
      {item.market_value > 0 && (
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>{formatPrice(item.market_value)}</Text>
        </View>
      )}

      {/* Seller avatar */}
      <Avatar alt={sellerHandle} size="xs" style={styles.avatarChip}>
        <AvatarImage source={{ uri: item.seller_avatar_url ?? undefined }} />
        <AvatarFallback>
          <AvatarFallbackText>{sellerInitial}</AvatarFallbackText>
        </AvatarFallback>
      </Avatar>
    </View>
  )
}

export function FeaturedCard({ item, isOpen }: { item: FeaturedCardItem; isOpen?: boolean }) {
  const router = useRouter()
  const sellerHandle = item.seller_username ?? item.seller_display_name ?? 'Unknown'
  const sellerInitial = sellerHandle.charAt(0).toUpperCase()
  const isGraded = item.price_key !== 'ungraded' && item.grading_company

  if (!isOpen) {
    return <CardThumbnail item={item} />
  }

  return (
    <View style={styles.expandedWrapper}>
      <CardThumbnail item={item} />

      <View style={styles.detailPanel}>
        <Text variant="h3" style={styles.cardName} numberOfLines={2}>
          {item.name ?? 'Unknown Card'}
        </Text>

        {item.set_name && (
          <Text style={{ color: Colors.$textNeutral, fontSize: 12 }} numberOfLines={1}>
            {item.set_name}
          </Text>
        )}

        {isGraded && (
          <Text style={{ color: Colors.$textNeutral, fontSize: 11 }}>
            {item.grading_company} {item.price_key}
          </Text>
        )}

        <Text style={styles.priceDetail}>{formatPrice(item.market_value)}</Text>

        <View style={styles.sellerRow}>
          <Avatar alt={sellerHandle} size="xs">
            <AvatarImage source={{ uri: item.seller_avatar_url ?? undefined }} />
            <AvatarFallback>
              <AvatarFallbackText>{sellerInitial}</AvatarFallbackText>
            </AvatarFallback>
          </Avatar>
          <Text style={{ color: Colors.$textNeutral, fontSize: 12 }} numberOfLines={1}>
            @{sellerHandle}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.storefrontBtn}
          onPress={() => router.push(`/storefront/${item.seller_username}` as any)}
          activeOpacity={0.75}
        >
          <Text style={styles.storefrontBtnText}>View Storefront</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  priceBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.88),
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.$textDefault,
  },
  avatarChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderWidth: 1.5,
    borderColor: Colors.$backgroundDefault,
  },
  expandedWrapper: {
    flexDirection: 'row',
    gap: 12,
    minWidth: '100%',
    alignItems: 'flex-start',
  },
  detailPanel: {
    flex: 1,
    gap: 6,
    paddingVertical: 4,
  },
  cardName: {
    fontWeight: '700',
    lineHeight: 20,
  },
  priceDetail: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.$backgroundPrimaryHeavy,
    marginTop: 2,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storefrontBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.15),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.4),
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  storefrontBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.$backgroundPrimaryHeavy,
  },
})
