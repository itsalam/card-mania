import { getSupabase } from '@/lib/store/client'
import { useQuery } from '@tanstack/react-query'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL

export type FeaturedListing = {
  collection_item_id: string
  collection_id: string
  storefront_id: string
  seller_id: string
  seller_username: string | null
  seller_display_name: string | null
  seller_avatar_url: string | null
  item_kind: string
  ref_id: string
  grade_condition_id: string | null
  grading_company: string | null
  quantity: number
  variants: string[] | null
  listed_at: string | null
  name: string | null
  set_name: string | null
  latest_price: number | null
  grades_prices: Record<string, number> | null
  genre: string | null
  front_id: string | null
  back_id: string | null
  price_key: string
  market_value: number
}

export type PublicStorefront = {
  storefront_id: string
  seller_id: string
  seller_username: string | null
  seller_display_name: string | null
  seller_avatar_url: string | null
  seller_is_seller: boolean
  title: string | null
  description: string | null
  tags: string[]
  listed_at: string | null
  item_count: number
}

export function useFeaturedListings(limit = 20) {
  return useQuery<FeaturedListing[]>({
    queryKey: [supabaseUrl, 'marketplace', 'featured', limit],
    queryFn: async () => {
      const { data, error } = await (getSupabase() as any).rpc('get_featured_listings', {
        result_limit: limit,
      })
      if (error) throw error
      return (data ?? []) as FeaturedListing[]
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })
}

export function usePublicStorefronts(limit = 20, pageParam?: string) {
  return useQuery<PublicStorefront[]>({
    queryKey: [supabaseUrl, 'marketplace', 'storefronts', limit, pageParam],
    queryFn: async () => {
      const { data, error } = await (getSupabase() as any).rpc('get_public_storefronts', {
        result_limit: limit,
        page_param: pageParam ?? null,
      })
      if (error) throw error
      return (data ?? []) as PublicStorefront[]
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })
}
