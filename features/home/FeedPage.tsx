import { useHomeFeedSections } from '@/client/home/sections'
import React from 'react'
import { View } from 'react-native'
import { useAvailableNowSection } from './cards/AvailableNow'
import { useCollectionsPreviewSection } from './cards/CollectionsPreview'
import { usePromosSection } from './cards/Promos'
import { useSuggestedSellersSection } from './cards/SuggestedSellers'

// Used before the config query resolves (or if it errors) so the feed isn't empty —
// matches the section set/order this table was seeded with.
const DEFAULT_SECTION_ORDER = ['promos', 'wishlist_hits', 'collections', 'suggested_sellers']

/**
 * Returns each section's header/body as individual nodes (see ExpandableSection) so HomeContent
 * can flatten them as direct children of its outer ScrollView, with headers pinned via
 * `stickyHeaderIndices`. The three section hooks are called unconditionally (Rules of Hooks —
 * order must stay stable regardless of `keys`), so a disabled section's data still fetches even
 * when not shown.
 */
export function useFeedSections() {
  const { data: sections } = useHomeFeedSections()

  const keys = sections?.length ? sections.map((s) => s.key) : DEFAULT_SECTION_ORDER
  const configByKey = new Map(sections?.map((s) => [s.key, s]))

  const wishlistHits = useAvailableNowSection(configByKey.get('wishlist_hits'))
  const collections = useCollectionsPreviewSection(configByKey.get('collections'))
  const suggestedSellers = useSuggestedSellersSection(configByKey.get('suggested_sellers'))
  const promos = usePromosSection(configByKey.get('promos'))

  const sectionsByKey: Record<
    string,
    { header: React.ReactNode; body: React.ReactNode; headerless?: boolean }
  > = {
    promos,
    wishlist_hits: wishlistHits,
    collections,
    suggested_sellers: suggestedSellers,
  }

  const children: React.ReactNode[] = []
  const stickyHeaderIndices: number[] = []

  for (const key of keys) {
    const section = sectionsByKey[key]
    // Header-less slots (promos) are plain children: nothing to pin, nothing when empty.
    if (section?.headerless) {
      if (section.body) children.push(<View key={`${key}-body`}>{section.body}</View>)
      continue
    }
    if (!section || !section.header) continue
    stickyHeaderIndices.push(children.length)
    children.push(<View key={`${key}-header`}>{section.header}</View>)
    children.push(<View key={`${key}-body`}>{section.body}</View>)
  }

  return { children, stickyHeaderIndices }
}
