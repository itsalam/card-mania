// ITS-133: collection value and price freshness. Definitions: docs/collections/valuation.md.
//   * Total Value = the Vault; For Sale = the Selling total (mirrored into the Vault);
//     PC = Vault - For Sale. The wishlist is never included.
//   * An item's price is the latest CardHedger price for its grade; none counts as $0.
//   * A card's prices are as fresh as the later of the scheduled refresh and an on-demand fetch.

import { useDefaultCollectionIds } from '@/features/collection/hooks'
import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useQuery } from '@tanstack/react-query'

export type CollectionValuation = {
  totalCents: number
  pricedQuantity: number
  unpricedQuantity: number
  /** The oldest price behind the total, or null when nothing is priced. */
  pricesAsOf: string | null
}

/** PC (kept) and For Sale shares of the owned total. Selling is part of the Vault. */
export function splitOwnedValue(vaultCents: number, sellingCents: number) {
  const forSale = Math.max(0, Math.min(sellingCents, vaultCents))
  return { total: vaultCents, pc: vaultCents - forSale, forSale }
}

/** When a card's prices were last updated, from either refresh path (ISO string or null). */
export function cardPricesAsOf(
  card?: {
    prices_refreshed_at?: string | null
    last_updated?: string | null
  } | null
): string | null {
  const times = [card?.prices_refreshed_at, card?.last_updated]
    .map((t) => (t ? Date.parse(t) : NaN))
    .filter((t) => Number.isFinite(t))
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}

/** "Nov 24", or "Nov 24, 2025" outside the current year. */
export function formatPriceDate(iso: string | null | undefined, now = new Date()) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

/** Value, priced/unpriced counts and freshness for one collection (default ones by type). */
export function useCollectionValuation(args: {
  collectionId?: string
  collectionType?: 'vault' | 'selling' | 'wishlist'
}) {
  const { collectionId, collectionType } = args
  const { data: defaultIds } = useDefaultCollectionIds(Boolean(collectionType))
  const id = collectionId ?? (collectionType ? defaultIds?.[collectionType] : undefined)

  return useQuery<CollectionValuation>({
    enabled: Boolean(id),
    queryKey: [...qk.collections, id, 'valuation'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('collection_valuation', {
        p_collection_id: id!,
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return {
        totalCents: Number(row?.total_cents ?? 0),
        pricedQuantity: Number(row?.priced_quantity ?? 0),
        unpricedQuantity: Number(row?.unpriced_quantity ?? 0),
        pricesAsOf: row?.prices_as_of ?? null,
      }
    },
  })
}
