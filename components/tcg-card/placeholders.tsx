
import { supabase } from '@/lib/store/client'
import { TransformOptions } from '@supabase/storage-js'
import { ImageBackground } from 'expo-image'
import { ComponentProps } from 'react'
import { Colors } from 'react-native-ui-lib'
import { Spinner } from '../ui/spinner'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from './consts'

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
  const transformParams: TransformOptions = {
    resize: 'cover',
    quality: 100,
    width: finalWidth,
    height: finalHeight,
  }

  const placeholderUrl = supabase.storage
    .from('placeholder')
    .getPublicUrl('default.png', { transform: transformParams }).data.publicUrl
  const defaultPlaceHolder = {
    uri: placeholderUrl,
    cacheKey: `card-placeholder-${finalWidth}x${finalHeight}`,
  }

  source = placeholderOnly ? defaultPlaceHolder : source

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
      source={source || defaultPlaceHolder}
      cachePolicy="memory-disk"
      transition={200}
      placeholderContentFit="cover"
      contentFit="cover"
      {...props}
    />
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
