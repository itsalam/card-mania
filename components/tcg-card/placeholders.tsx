import { getSupabase } from '@/lib/store/client'
import { TransformOptions } from '@supabase/storage-js'
import { Image, ImageBackground } from 'expo-image'
import { ComponentProps } from 'react'
import { Dimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { Spinner } from '../ui/spinner'
import { CARD_ASPECT_RATIO, CARD_WIDTH_RATIO, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from './consts'

/** The app's one generic card placeholder (Supabase storage's `placeholder/default.png`),
 *  resized per target dimensions — shared by CardPlaceholderImage below and by whatever prefetch
 *  warms this at app load (app/_layout.tsx), so both compute the exact same uri+cacheKey and a
 *  cold `<Image>` request always lands on an already-warm cache entry instead of a fresh fetch. */
export function getDefaultCardPlaceholderSource(width: number, height: number) {
  const finalWidth = Math.round(width)
  const finalHeight = Math.round(height)
  const transformParams: TransformOptions = {
    resize: 'cover',
    quality: 100,
    width: finalWidth,
    height: finalHeight,
  }
  const placeholderUrl = getSupabase()
    .storage.from('placeholder')
    .getPublicUrl('default.png', { transform: transformParams }).data.publicUrl
  return {
    uri: placeholderUrl,
    cacheKey: `card-placeholder-${finalWidth}x${finalHeight}`,
  }
}

export function CardPlaceholderImage({
  style,
  isLoading,
  width,
  height,
  placeholderOnly,
  source,
  ...props
}: {
  isLoading?: boolean
  width?: number
  height?: number
  placeholderOnly?: boolean
} & React.ComponentProps<typeof ImageBackground>) {
  const finalWidth = Math.round(
    width ? width : height ? Math.round(height * (5 / 7)) : THUMBNAIL_WIDTH
  )
  const finalHeight = Math.round(
    height ? height : width ? Math.round(width * (7 / 5)) : THUMBNAIL_HEIGHT
  )
  const defaultPlaceHolder = getDefaultCardPlaceholderSource(finalWidth, finalHeight)

  source = placeholderOnly ? defaultPlaceHolder : source
  const resolvedSource = placeholderOnly || !source ? defaultPlaceHolder : source
  return (
    <ImageBackground
      style={{
        aspectRatio: 5 / 7,
        opacity: isLoading ? 0.5 : 1,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: Colors.$backgroundNeutralLight,
        width: finalWidth,
        height: finalHeight,
      }}
      placeholder={defaultPlaceHolder}
      source={resolvedSource}
      cachePolicy="memory-disk"
      transition={200}
      placeholderContentFit="fill"
      contentFit="cover"
      {...props}
    />
  )
}

// The two placeholder sizes actually requested across the app: THUMBNAIL_WIDTH/HEIGHT is
// CardImage's own default for list tiles (features/tcg-card-views/card-image.tsx); the second
// matches DetailCardView's hero image width (windowWidth * CARD_WIDTH_RATIO) at the standard
// card aspect ratio (the generic placeholder has no specific card's own aspect ratio to use yet).
const { width: windowWidth } = Dimensions.get('window')
const PREFETCH_SIZES: { width: number; height: number }[] = [
  { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT },
  {
    width: windowWidth * CARD_WIDTH_RATIO,
    height: (windowWidth * CARD_WIDTH_RATIO) / CARD_ASPECT_RATIO,
  },
]

/** Mount once at app root (see app/_layout.tsx) — renders the generic card placeholder
 *  (getDefaultCardPlaceholderSource above) off-screen at every size actually requested
 *  elsewhere, so expo-image's cache is already warm under the exact same uri+cacheKey by the
 *  time CardPlaceholderImage/LoadingImagePlaceholder (list tiles) or DetailCardView's hero image
 *  ask for it — rather than each one cold-fetching it the first time a user opens a card in a
 *  session. A real (invisible) mounted `<Image>`, not Image.prefetch — prefetch only caches by
 *  URL and has no way to attach the custom `cacheKey` these later lookups key on, so a
 *  URL-only prefetch wouldn't actually be found by them. */
export function CardPlaceholderPrefetch() {
  return (
    <>
      {PREFETCH_SIZES.map(({ width, height }) => (
        <Image
          key={`${width}x${height}`}
          source={getDefaultCardPlaceholderSource(width, height)}
          cachePolicy="memory-disk"
          pointerEvents="none"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, top: -9999 }}
        />
      ))}
    </>
  )
}

export function LoadingImagePlaceholder({
  isLoading,
  ...props
}: { isLoading?: boolean; width?: number; height?: number } & ComponentProps<
  typeof CardPlaceholderImage
>) {
  return (
    <>
      <CardPlaceholderImage isLoading={isLoading} {...props}></CardPlaceholderImage>
      {isLoading && (
        <Spinner
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
          }}
        />
      )}
    </>
  )
}
