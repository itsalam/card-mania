import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { Image } from 'expo-image'
import { FolderHeart, LucideIcon } from 'lucide-react-native'
import React from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { collectionAccentColor, collectionIcon } from './appearance'

export const CollectionsAvatar = ({
  icon: Icon,
  iconImageSrc,
  iconKey,
  accentColor,
  size = 56,
}: {
  /** Fallback icon when the collection hasn't picked one (e.g. Heart for the wishlist row). */
  icon?: LucideIcon
  iconImageSrc?: string
  /** collections.icon_key — wins over `icon` and the cover image. */
  iconKey?: string | null
  /** collections.accent_color — tints the tile's border, fill and icon. */
  accentColor?: string | null
  size?: number
}) => {
  const scheme = useEffectiveColorScheme()
  const Chosen = collectionIcon(iconKey) ?? Icon
  const accent = collectionAccentColor(accentColor)
  const stroke = accent ?? Colors.$textPrimary
  const iconSize = Math.round(size * 0.43)

  return (
    <View
      key={scheme}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.21),
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: accent ?? Colors.$outlinePrimary,
        borderWidth: 2,
        backgroundColor: accent ? Colors.rgba(accent, 0.16) : Colors.$backgroundNeutral,
      }}
    >
      {Chosen ? (
        <Chosen height={iconSize} width={iconSize} strokeWidth={2} stroke={stroke} />
      ) : iconImageSrc ? (
        <Image
          source={{ uri: iconImageSrc }}
          style={{ height: iconSize + 8, width: iconSize + 8 }}
        />
      ) : (
        <FolderHeart
          height={Math.round(size * 0.36)}
          width={Math.round(size * 0.36)}
          strokeWidth={1.5}
          stroke={stroke}
        />
      )}
    </View>
  )
}
