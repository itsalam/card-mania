import { useImageProxy } from '@/client/image-proxy'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { collectionAccentColor } from './appearance'

// Colors.rgba is typed string | undefined; LinearGradient needs concrete colors.
const rgba = (color: string, alpha: number) => Colors.rgba(color, alpha) ?? 'transparent'

/**
 * Absolute-fill backdrop for a collection surface (ITS-98). In order of preference: the user's
 * uploaded background, the default background (the collection's most valuable card, kept up to
 * date server-side in `default_background_card_id`, blurred since card art cropped to a wide
 * strip is busy), or a faint wash of the accent color. Images get a scrim in the surface color
 * so text on top stays legible. Renders nothing when none apply. Place it as the first child of
 * a container with `overflow: 'hidden'`.
 */
export function CollectionBackground({
  imageId,
  defaultCardId,
  accentColor,
  surfaceColor = Colors.$backgroundElevatedLight,
  variant = 'detail',
}: {
  imageId?: string | null
  /** The collection's `default_background_card_id`, used when no image is uploaded. */
  defaultCardId?: string | null
  accentColor?: string | null
  /** The container's own background — the scrim fades the image into it. */
  surfaceColor?: string
  variant?: 'thumb' | 'detail'
}) {
  const accent = collectionAccentColor(accentColor)
  const { data: uploaded } = useImageProxy({
    imageId: imageId ?? undefined,
    variant,
    shape: 'original',
    fit: 'cover',
  })
  // Only resolved when there's no upload; card ids go through the proxy's card_id + kind lookup.
  const { data: card } = useImageProxy({
    cardId: imageId ? undefined : (defaultCardId ?? undefined),
    imageType: 'front',
    variant,
    shape: 'original',
    fit: 'cover',
  })
  const isDefault = !imageId
  const url = imageId ? uploaded?.url : card?.url

  if (!imageId && !defaultCardId && !accent) return null

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {url ? (
        <>
          <Image
            source={{ uri: url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={isDefault ? 12 : 0}
            transition={150}
          />
          <LinearGradient
            colors={[rgba(surfaceColor, 0.55), rgba(surfaceColor, 0.92)]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : accent ? (
        <LinearGradient
          colors={[rgba(accent, 0.16), rgba(accent, 0.02)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  )
}
