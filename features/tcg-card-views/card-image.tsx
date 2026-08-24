import { useImageProxy } from '@/client/image-proxy'
import { CARD_ASPECT_RATIO } from '@/components/consts'
import React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../../components/tcg-card/consts'
import { LiquidGlassCard, LiquidGlassCardProps } from '../../components/tcg-card/GlassCard'
import { LoadingImagePlaceholder } from '../../components/tcg-card/placeholders'
import { buildThumbCacheKey } from './helpers'
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

  // Deliberately NOT the resolved image's own pixel ratio — the card slot always keeps a
  // uniform aspect ratio (falling back to the standard card ratio) and the photo is fit
  // to it below via `contentFit="cover"`, so a user-uploaded photo with an arbitrary
  // aspect ratio can't stretch or resize the container.
  const aspectRatio = displayData?.aspectRatio ?? CARD_ASPECT_RATIO

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
          cacheKey: displayData ? buildThumbCacheKey(displayData.imageProxyArgs) : undefined,
          width: finalWidth,
          height: finalHeight,
        }}
        width={finalWidth}
        height={finalHeight}
        contentFit="cover"
        isLoading={isLoading || isImageLoading}
      />
    </LiquidGlassCard>
  )
}
