import { supabase } from '@/store/client'
import { TransformOptions } from '@supabase/storage-js'
import { ImageBackground } from 'expo-image'
import { ComponentProps } from 'react'
import { View } from 'react-native-ui-lib'
import { Spinner } from '../ui/spinner'

export function CardPlaceholderImage(
  props: { isLoading?: boolean } & React.ComponentProps<typeof ImageBackground>
) {
  const transformParams: TransformOptions = {
    resize: 'cover',
    quality: 100,
    width: 96,
    height: 133,
  }

  const placeholderUrl = supabase.storage
    .from('placeholder')
    .getPublicUrl('default.png', { transform: transformParams }).data.publicUrl

  return (
    <ImageBackground
      style={{
        width: 96,
        aspectRatio: 5 / 7,
        opacity: props.isLoading ? 0.5 : 1,
        borderRadius: 5,
        overflow: 'hidden',
      }}
      placeholder={{ uri: placeholderUrl, cacheKey: 'card-placeholder' }}
      cachePolicy="memory-disk"
      transition={200}
      contentFit="cover"
      {...props}
    />
  )
}

export function LoadingImagePlaceholder({
  isLoading,
  ...props
}: { isLoading?: boolean } & ComponentProps<typeof CardPlaceholderImage>) {
  console.log({ isLoading })
  return (
    <View>
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
    </View>
  )
}
