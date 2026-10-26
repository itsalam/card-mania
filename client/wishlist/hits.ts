import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { useQuery } from '@tanstack/react-query'

/**
 * A wishlisted card currently listed by another seller — one row per card + grade.
 * Prices are cents; `current_price_cents` is market value at the listing's grade (listings
 * have no asking price), `snapshot_price_cents` the same grade's price when it was wishlisted.
 * See get_wishlist_hits in supabase/migrations/20261025000004_wishlist_hits_rpc.sql.
 */
export type WishlistHit = {
  wishlist_item_id: string
  wishlisted_at: string
  listing_item_id: string
  listing_collection_id: string
  storefront_id: string
  listed_at: string | null
  ref_id: string
  name: string | null
  set_name: string | null
  grading_company: string | null
  price_key: string
  seller_id: string
  seller_username: string | null
  seller_display_name: string | null
  seller_avatar_url: string | null
  current_price_cents: number | null
  snapshot_price_cents: number | null
  snapshot_at: string | null
  savings_pct: number | null
  prices_refreshed_at: string | null
  other_listings_count: number
}

export const wishlistHitsKey = (userId?: string, limit?: number) =>
  ['wishlist', 'hits', userId, limit] as const

export function useWishlistHits(limit = 10) {
  const userId = useUserStore((s) => s.user?.id)
  return useQuery<WishlistHit[]>({
    queryKey: wishlistHitsKey(userId, limit),
    queryFn: async () => {
      const { data, error } = await (getSupabase() as any).rpc('get_wishlist_hits', {
        p_limit: limit,
      })
      if (error) throw error
      return (data ?? []) as WishlistHit[]
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })
}

/**
 * Savings vs. the wishlisted price, only when the price actually dropped — a rise or no
 * snapshot shows no badge / strike-through.
 */
export function getSavings(hit: Pick<WishlistHit, 'current_price_cents' | 'snapshot_price_cents'>) {
  const { current_price_cents: now, snapshot_price_cents: then } = hit
  if (!now || !then || then <= now) return null
  return { pct: Math.round(((then - now) / then) * 100), compareAt: then }
}

/**
 * Route to the listing — kept in step with generate_wishlist_hit_notifications' action_url
 * ('/profile/<listing_item_id>?cardId=…&collectionId=…').
 */
export function listingRoute(
  hit: Pick<WishlistHit, 'listing_item_id' | 'ref_id' | 'listing_collection_id'>
) {
  return {
    pathname: '/profile/[shop-item]' as const,
    params: {
      'shop-item': hit.listing_item_id,
      cardId: hit.ref_id,
      collectionId: hit.listing_collection_id,
    },
  }
}
