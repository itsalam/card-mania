import { useImageProxy } from '@/client/image-proxy'
import { CARD_ASPECT_RATIO } from '@/components/consts'
import React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../../components/tcg-card/consts'
import { LiquidGlassCard, LiquidGlassCardProps } from '../../components/tcg-card/GlassCard'
import { LoadingImagePlaceholder } from '../../components/tcg-card/placeholders'
import { DisplayData } from './types'

export function CardImage(props: {
  isLoading?: boolean
  displayData: DisplayData | null
  imageProps?: LiquidGlassCardProps & {
    ref?: React.Ref<React.ComponentRef<typeof LiquidGlassCard>>
  }
  cardContainerStyle?: StyleProp<ViewStyle>
}) {
  const { isLoading = false, cardContainerStyle, displayData, imageProps } = props

  const { data: thumbnailImg, isLoading: isImageLoading } = useImageProxy({
    variant: 'tiny',
    ...displayData?.imageProxyArgs,
  })

  return (
    <LiquidGlassCard
      variant="primary"
      className="p-0 aspect-[5/7] flex items-center justify-center overflow-hidden"
      style={[cardContainerStyle, { width: THUMBNAIL_WIDTH, aspectRatio: CARD_ASPECT_RATIO }]}
      {...imageProps}
    >
      <LoadingImagePlaceholder
        source={{
          uri: thumbnailImg,
          cacheKey: `${displayData?.imageProxyArgs.imageId || displayData?.imageProxyArgs.cardId}-thumb`,
          width: THUMBNAIL_WIDTH,
          height: THUMBNAIL_HEIGHT,
        }}
        contentFit="cover"
        isLoading={isLoading || isImageLoading}
      />
    </LiquidGlassCard>
  )
}
