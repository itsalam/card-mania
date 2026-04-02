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
  width?: number
  height?: number
  cardContainerStyle?: StyleProp<ViewStyle>
}) {
  const { isLoading = false, cardContainerStyle, displayData, imageProps, height, width } = props

  const { data: thumbnailImgResult, isLoading: isImageLoading } = useImageProxy({
    variant: 'tiny',
    ...displayData?.imageProxyArgs,
  })
  const thumbnailImg = thumbnailImgResult?.url
  // Use the resolved W/H ratio from image-proxy; fall back to the standard card ratio while loading.
  const aspectRatio =
    thumbnailImgResult?.aspectRatio ?? displayData?.aspectRatio ?? CARD_ASPECT_RATIO

  const finalWidth = width ?? (height !== undefined ? height * aspectRatio : THUMBNAIL_WIDTH)
  const finalHeight = height ?? (width !== undefined ? width / aspectRatio : THUMBNAIL_HEIGHT)

  return (
    <LiquidGlassCard
      variant="primary"
      className="p-0 flex items-center justify-center overflow-hidden"
      style={[
        {
          width: finalWidth,
          height: finalHeight,
          aspectRatio,
        },
        cardContainerStyle,
      ]}
      {...imageProps}
    >
      <LoadingImagePlaceholder
        key={thumbnailImg}
        source={{
          uri: thumbnailImg,
          cacheKey: `${displayData?.imageProxyArgs.queryHash || displayData?.imageProxyArgs.imageId || displayData?.imageProxyArgs.cardId}-thumb`,
          width: finalWidth,
          height: finalHeight,
        }}
        width={finalWidth}
        height={finalHeight}
        contentFit="fill"
        isLoading={isLoading || isImageLoading}
      />
    </LiquidGlassCard>
  )
}
