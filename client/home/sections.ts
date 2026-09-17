import { getSupabase } from '@/lib/store/client'
import { useQuery } from '@tanstack/react-query'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL

/**
 * Rail sizing overrides for ExpandableCard — see home_feed_section_meta.layout. There's no
 * `collapsedHeight` here: ExpandableCard measures the collapsed rail's height from the actual
 * rendered items rather than taking a caller-computed value (see ITS-107 follow-up) — a
 * `layout.collapsedHeight` value already stored in the DB from before that change is simply
 * ignored now, not an error.
 */
export type HomeFeedSectionLayout = {
  itemWidth?: number
  expandedHeight?: number
  /** Collapsed-rail item width override, independent of `itemWidth` (used for e.g. Collections,
   *  where the collapsed item needs to be wide enough to fit a title but the expanded-row icon
   *  should stay at the smaller `itemWidth` basis). */
  collapsedWidth?: number
  /** Whether this section can open into an expanded list at all — false renders a rail-only
   *  section with no "See all" affordance (e.g. Suggested Sellers). Each section component
   *  supplies its own default when this key is absent from a stored row. */
  expandable?: boolean
}

export type HomeFeedSectionConfig = {
  key: string
  title: string
  icon: string
  sort_order: number
  result_limit: number
  layout: HomeFeedSectionLayout
}

/**
 * Home feed section config — title, icon, ordering, result limit, and rail layout for
 * Wishlist Hits / Collections / Suggested Sellers, served from `get_home_feed_sections()`
 * (mirrors the marketplace_section_meta precedent, see client/marketplace/index.ts). Each
 * section still fetches its own per-user items via its existing hook — this table only
 * drives which sections show, in what order, and how their rail is sized.
 */
export function useHomeFeedSections() {
  return useQuery<HomeFeedSectionConfig[]>({
    queryKey: [supabaseUrl, 'home', 'feed-sections'],
    queryFn: async () => {
      const { data, error } = await (getSupabase() as any).rpc('get_home_feed_sections')
      if (error) throw error
      return (data ?? []) as HomeFeedSectionConfig[]
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })
}
