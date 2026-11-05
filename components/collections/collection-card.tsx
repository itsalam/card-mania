import { Text } from '@/components/ui/text/base-text'
import { useGetCollectionCountInfo } from '@/features/collection/hooks'
import { VISIBILITY_OPTIONS } from '@/features/tcg-card-views/DetailCardView/components/ui'
import { LucideIcon } from 'lucide-react-native'
import React, { ReactNode } from 'react'
import { View } from 'react-native'
import { BorderRadiuses, Colors, TouchableOpacity } from 'react-native-ui-lib'
import { collectionAccentColor } from './appearance'
import { CollectionsAvatar } from './avatar'
import { CollectionBackground } from './background'

export const COMPACT_COLLECTION_CARD_WIDTH = 132
export const COMPACT_COLLECTION_CARD_HEIGHT = 128

/** Structural subset both `CollectionRow` (non-nullable DB row) and `CollectionLike`
 *  (fully-nullable row + membership fields) satisfy, so this card can render either. */
type CollectionCardData = {
  id?: string | null
  name?: string | null
  description?: string | null
  cover_image_url?: string | null
  visibility?: string | null
  icon_key?: string | null
  accent_color?: string | null
  background_image_id?: string | null
}

export function CollectionCard({
  collection,
  onPress,
  isLoading,
  compact,
  icon,
  rightElement,
}: {
  collection: CollectionCardData
  onPress: () => void
  isLoading?: boolean
  compact?: boolean
  /** Fallback avatar icon shown when there's no cover image (e.g. Heart for the wishlist row). */
  icon?: LucideIcon
  /** Trailing accessory, e.g. a RadioButton indicating the target card's membership. */
  rightElement?: ReactNode
}) {
  // 'wishlist' is a client-side sentinel id for the default wishlist bucket, not a real
  // collection row — skip the count query rather than firing it with an invalid uuid.
  const validId = collection?.id && collection.id !== 'wishlist' ? collection.id : undefined
  const { data: count } = useGetCollectionCountInfo(
    isLoading || !validId ? {} : { collectionId: validId }
  )
  const visibilityInfo = VISIBILITY_OPTIONS.find((v) => v.key === collection?.visibility)
  const VisibilityIcon = visibilityInfo?.icon
  // ITS-98: the accent shows as a left accent border alongside the normal outline (CLAUDE.md
  // "Accent borders vs. visibility borders"), plus a faint wash / background image behind.
  const accent = collectionAccentColor(collection?.accent_color)
  const accentBorder = accent ? { borderLeftWidth: 4, borderLeftColor: accent } : {}
  const avatar = (
    <CollectionsAvatar
      icon={icon}
      iconImageSrc={collection.cover_image_url ?? undefined}
      iconKey={collection.icon_key}
      accentColor={collection.accent_color}
    />
  )
  const backdrop = (
    <CollectionBackground
      imageId={collection.background_image_id}
      accentColor={collection.accent_color}
      variant="thumb"
    />
  )

  if (isLoading) {
    return (
      <View
        style={
          compact
            ? {
                width: COMPACT_COLLECTION_CARD_WIDTH,
                height: COMPACT_COLLECTION_CARD_HEIGHT,
                borderRadius: BorderRadiuses.br50,
                borderWidth: 2,
                borderColor: Colors.$outlineNeutral,
                backgroundColor: Colors.$backgroundElevatedLight,
              }
            : {
                borderRadius: BorderRadiuses.br50,
                borderWidth: 2,
                borderColor: Colors.$outlineNeutral,
                backgroundColor: Colors.$backgroundElevatedLight,
                padding: 14,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'flex-start',
              }
        }
      />
    )
  }

  if (compact) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <View
          style={{
            width: COMPACT_COLLECTION_CARD_WIDTH,
            borderRadius: BorderRadiuses.br50,
            borderWidth: 2,
            borderColor: Colors.$outlineNeutral,
            backgroundColor: Colors.$backgroundElevatedLight,
            padding: 12,
            gap: 8,
            alignItems: 'center',
            overflow: 'hidden',
            ...accentBorder,
          }}
        >
          {backdrop}
          {avatar}
          <View style={{ gap: 2, alignItems: 'center', width: '100%' }}>
            <Text variant="h4" numberOfLines={1} style={{ textAlign: 'center' }}>
              {collection.name}
            </Text>
            <Text style={{ color: Colors.$textNeutral }}>{count ?? 0} items</Text>
          </View>
          {rightElement}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View
        style={{
          borderRadius: BorderRadiuses.br50,
          borderWidth: 2,
          borderColor: Colors.$outlineNeutral,
          backgroundColor: Colors.$backgroundElevatedLight,
          padding: 14,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start',
          overflow: 'hidden',
          ...accentBorder,
        }}
      >
        {backdrop}
        {avatar}
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="h4">{collection.name}</Text>
          {!!collection.description && (
            <Text numberOfLines={2} style={{ color: Colors.$textNeutralHeavy }}>
              {collection.description}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Text style={{ color: Colors.$textNeutral }}>{count ?? 0} items</Text>
            {visibilityInfo && (
              <>
                <Text style={{ color: Colors.$textNeutral }}>•</Text>
                {VisibilityIcon && <VisibilityIcon size={12} color={Colors.$textNeutral} />}
                <Text style={{ color: Colors.$textNeutral }}>{visibilityInfo.label}</Text>
              </>
            )}
          </View>
        </View>
        {rightElement}
      </View>
    </TouchableOpacity>
  )
}
