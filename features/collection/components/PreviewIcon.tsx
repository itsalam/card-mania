import { LiquidGlassCard } from "@/components/tcg-card/GlassCard";
import { VStack } from "@/components/ui/vstack";
import { cn } from "@/lib/utils/cn";
import { ComponentProps } from "react";
import { StyleSheet } from 'react-native';

const ITEM_WIDTH = 72
const ITEM_ASPECT_RATIO = 5 / 7

export function CollectionsPreviewIcon({ className, style, width = ITEM_WIDTH, ...props }:  ComponentProps<typeof VStack> & { width?: number; className?: string }) {

  const CONDENSED_ITEM_HEIGHT = width / ITEM_ASPECT_RATIO
  const EXPANDED_CARD_HEIGHT = CONDENSED_ITEM_HEIGHT * 3 + 24
  const TOTAL_CARDS = 3

  function Card({index, className, style, ...props}: {index: number} & ComponentProps<typeof VStack>) {

        const centerOffset = (TOTAL_CARDS - 1) * 7/4;

    // Initial stacked position - centered with slight overlap
    const defaultX = index * 3 - 0;
    const defaultY = index * 2;
    const defaultRotate = index * 5.5;
    const defaultScale = 1 - (index * 0.05);

    return (
      <LiquidGlassCard
        className={cn(className,"absolute")}
        variant="primary"
        style={{
          position: 'absolute',
          width,
          aspectRatio: ITEM_ASPECT_RATIO,
          left: defaultX,
          top: defaultY,
          rotate: `${defaultRotate}deg`,
          scale: defaultScale,
          ...StyleSheet.flatten(style),
        }}
        {...props}
      />
    )
  }


  return (
    <VStack
      style={{
        height: EXPANDED_CARD_HEIGHT,
        width: width + 16,
        aspectRatio: ITEM_ASPECT_RATIO,
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        position: 'relative',
      }}
    >
      {Array(TOTAL_CARDS)
        .fill(null)
        .map((_, index) => (
          <Card
            key={index}
            index={index}
            className={className}
          />
        ))}
    </VStack>
  )
}
