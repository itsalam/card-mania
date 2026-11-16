import { HomeFeedSectionConfig } from '@/client/home/sections'
import { type Promo, useActivePromos, usePromoImpression } from '@/client/promos'
import { ProductBox } from '@/features/promos/ProductBox'
import React from 'react'
import { View } from 'react-native'

function TrackedBox({ promo }: { promo: Promo }) {
  usePromoImpression(promo)
  return <ProductBox promo={promo} />
}

/**
 * Home feed slot for promo boxes (home_feed_section_meta key 'promos', ITS-192). Hero boxes come
 * first, then rail boxes; `result_limit` caps how many show. No header: each box is its own card,
 * and the slot renders nothing when no promo is live.
 */
export function usePromosSection(config?: HomeFeedSectionConfig) {
  const limit = config?.result_limit ?? 5
  const { data: promos = [] } = useActivePromos()

  const ordered = [
    ...promos.filter((p) => p.placement === 'home_hero'),
    ...promos.filter((p) => p.placement !== 'home_hero'),
  ].slice(0, limit)

  const body =
    ordered.length > 0 ? (
      <View style={{ gap: 12, paddingTop: 4, paddingBottom: 12 }}>
        {ordered.map((p) => (
          <TrackedBox key={p.id} promo={p} />
        ))}
      </View>
    ) : null

  return { header: null, body, headerless: true as const }
}
