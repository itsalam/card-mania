import { useImageProxy } from '@/client/image-proxy'
import { CardTile } from '@/components/tcg-card/CardTile'
import { CARD_LIST_GAP } from '@/components/tcg-card/consts'
import { GradeBadge } from '@/components/tcg-card/GradeBadge'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import React from 'react'
import { type FeaturedCardItem } from './FeaturedCard'

/** Card grid layout shared by Marketplace and Home → Explore. */
export const GRID_COLUMNS = 3
export const GRID_GAP = CARD_LIST_GAP

/** Cell width for GRID_COLUMNS cells separated by GRID_GAP across `containerWidth`. */
export const gridCellWidth = (containerWidth: number) =>
  Math.floor((containerWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS)

export function chunkGridRows<T>(items: T[]): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += GRID_COLUMNS) rows.push(items.slice(i, i + GRID_COLUMNS))
  return rows
}

export function GridCard({ item, width }: { item: FeaturedCardItem; width: number }) {
  const router = useRouter()
  const isGraded = Boolean(item.grading_company) && item.price_key !== 'ungraded'

  const { data: imageData } = useImageProxy({
    variant: 'tiny',
    shape: 'card',
    cardId: item.ref_id,
    imageType: 'front',
  })

  return (
    <CardTile
      width={width}
      title={item.name ?? undefined}
      subtitle={item.set_name ?? undefined}
      price={item.market_value}
      badge={<GradeBadge priceKey={isGraded ? item.price_key : 'ungraded'} />}
      onPress={() =>
        router.push({ pathname: '/cards/[card]', params: { card: item.ref_id } } as any)
      }
      renderArt={({ width: artWidth, height: artHeight }) =>
        imageData?.url ? (
          <Image
            source={{ uri: imageData.url }}
            style={{ width: artWidth, height: artHeight }}
            contentFit="cover"
          />
        ) : null
      }
    />
  )
}
