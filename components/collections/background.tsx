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
 * Absolute-fill backdrop for a collection surface (ITS-98): the user's background image with a
 * scrim in the surface color so text on top stays legible, or — without an image — a faint wash
 * of the accent color. Renders nothing when neither is set. Place it as the first child of a
 * container with `overflow: 'hidden'`.
 */
export function CollectionBackground({
  imageId,
  accentColor,
  surfaceColor = Colors.$backgroundElevatedLight,
  variant = 'detail',
}: {
  imageId?: string | null
  accentColor?: string | null
  /** The container's own background — the scrim fades the image into it. */
  surfaceColor?: string
  variant?: 'thumb' | 'detail'
}) {
  const accent = collectionAccentColor(accentColor)
  const { data: proxy } = useImageProxy({
    imageId: imageId ?? undefined,
    variant,
    shape: 'original',
    fit: 'cover',
  })

  if (!imageId && !accent) return null

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {imageId && proxy?.url ? (
        <>
          <Image
            source={{ uri: proxy.url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
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
