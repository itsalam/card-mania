import { LiquidGlassCard } from '@/components/tcg-card/GlassCard'
import { CardPlaceholderImage } from '@/components/tcg-card/placeholders'
import { VStack } from '@/components/ui/vstack'
import { cn } from '@/lib/utils/cn'
import { ComponentProps } from 'react'
import { StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

const ITEM_WIDTH = 72
const ITEM_ASPECT_RATIO = 5 / 7

export function CollectionsPreviewIcon({
  className,
  style,
  width = ITEM_WIDTH,
  ...props
}: ComponentProps<typeof VStack> & { width?: number; className?: string }) {
  const CONDENSED_HEIGHT = width / ITEM_ASPECT_RATIO
  const HEIGHT = CONDENSED_HEIGHT + 24
  const TOTAL_CARDS = 4

  const Constants = {
    translateXPerCard: 0.01,
    translateYPerCard: 0.001,
    rotatePerCard: 6,
    scalePerCard: 0.05,
  }

  function Card({
    index,
    width,
    className,
    style,
    ...props
  }: { index: number; width: number } & ComponentProps<typeof VStack>) {
    const centerOffset = ((TOTAL_CARDS - 1) * 7) / 4
    const height = Math.round(width * (7 / 5))
    // Initial stacked position - centered with slight overlap
    const defaultX =
      (index % 2 ? -1 : 1) * Math.floor(index / 2) * 2 * width * Constants.translateXPerCard
    const defaultY = index * height * Constants.translateYPerCard
    const defaultRotate =
      index === 0
        ? 0
        : (index % 2 ? 1 : -1) * (Math.floor((index - 1) / 2) + 1) * 2 * Constants.rotatePerCard
    const defaultScale = 1 - index * Constants.scalePerCard
    return (
      <LiquidGlassCard
        className={cn(className, 'absolute')}
        variant="primary"
        style={{
          top: 0,
          left: 10,
          padding: 0,
          position: 'absolute',
          width,
          aspectRatio: ITEM_ASPECT_RATIO,
          transform: [
            {
              translateX: defaultX,
            },
            { translateY: defaultY },
            {
              rotate: `${defaultRotate}deg`,
            },
            {
              scale: defaultScale,
            },
          ],
          transformOrigin: 'bottom',
          zIndex: TOTAL_CARDS - index,
          overflow: 'hidden',
          ...StyleSheet.flatten(style),
        }}
        {...props}
      >
        <View
          style={{
            position: 'absolute',
            width: '100%',
            aspectRatio: ITEM_ASPECT_RATIO,
            backgroundColor: Colors.rgba(Colors.$backgroundNeutral, index === 0 ? 0.0 : 0.6),
            zIndex: 11,
            overflow: 'hidden',
          }}
        />
        <CardPlaceholderImage
          // source={{ uri: image, cacheKey: card?.id }}
          width={width}
          isLoading={false}
          style={{ zIndex: 10 }}
        />
      </LiquidGlassCard>
    )
  }

  return (
    <View
      style={{
        height: HEIGHT,
        width: width + 40,
        aspectRatio: ITEM_ASPECT_RATIO,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {Array(TOTAL_CARDS)
        .fill(null)
        .map((_, index) => (
          <Card width={width} key={index} index={index} className={className} />
        ))}
    </View>
  )
}
