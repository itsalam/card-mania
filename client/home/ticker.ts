import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { useQuery } from '@tanstack/react-query'

/**
 * One home ticker-tape entry: a card the user owns or watches (wishlist), its current market
 * price at the tracked grade, and the change over the window (null until enough price history
 * exists). Cents. See get_ticker_items in supabase/migrations/20261025000006_ticker_items_rpc.sql.
 */
export type TickerItem = {
  ref_id: string
  name: string | null
  set_name: string | null
  price_key: string
  source: 'owned' | 'watching'
  current_cents: number
  past_cents: number | null
  change_pct: number | null
}

export const TICKER_DAYS = 7

export const tickerItemsKey = (userId?: string) => ['home', 'ticker', userId, TICKER_DAYS] as const

export function useTickerItems(limit = 20) {
  const userId = useUserStore((s) => s.user?.id)
  return useQuery<TickerItem[]>({
    queryKey: tickerItemsKey(userId),
    queryFn: async () => {
      const { data, error } = await (getSupabase() as any).rpc('get_ticker_items', {
        p_limit: limit,
        p_days: TICKER_DAYS,
      })
      if (error) throw error
      return (data ?? []) as TickerItem[]
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })
}

/** Short ticker label: drops the "[Variation]" / "#123" noise vendor names carry. */
export function tickerName(name: string | null) {
  return (name ?? 'Card')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s*#\S+/g, '')
    .trim()
}
