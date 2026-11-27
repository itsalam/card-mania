// ITS-134: List for Sale, asking prices, and taking cards off sale.
// Decisions: docs/collections/list-for-sale.md.
//   * Listing moves copies out of a PC (Vault) row into the automatic "For Sale" storefront;
//     removing it from sale moves them back. The Vault total doesn't change.
//   * The asking price is required for new listings (prefilled with the market price for the
//     grade). Older listings have none and sell at the market price, labeled as such.

import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { reportError } from '@/lib/utils/report-error'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL

export type ListingPrice = {
  /** What a buyer pays per copy, in cents (0 when there's no price at all). */
  cents: number
  /** True when it's the seller's asking price; false when it falls back to the market price. */
  isAsking: boolean
}

/** The price a listing sells at: the seller's asking price, else the market price. */
export function listingPrice(item: {
  asking_price_cents?: number | null
  market_value?: number | null
}): ListingPrice {
  if (item.asking_price_cents && item.asking_price_cents > 0) {
    return { cents: item.asking_price_cents, isAsking: true }
  }
  return { cents: Math.max(0, Math.round(item.market_value ?? 0)), isAsking: false }
}

/** Copies of a listing that can still be bought (copies on hold for a sale don't count). */
export function availableQuantity(item: {
  quantity?: number | null
  held_quantity?: number | null
}) {
  return Math.max(0, (item.quantity ?? 0) - (item.held_quantity ?? 0))
}

/** Is this row a card that's for sale (a storefront listing, or its Selling / Vault mirror)? */
export function isListedRow(
  row: { mirror_of?: string | null } | null | undefined,
  collection?: { is_storefront?: boolean | null } | null
) {
  return Boolean(row?.mirror_of) || Boolean(collection?.is_storefront)
}

function useInvalidateListings() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: qk.collections })
    qc.invalidateQueries({ queryKey: [supabaseUrl, 'collection-item'] })
    qc.invalidateQueries({ queryKey: [supabaseUrl, 'marketplace'] })
  }
}

// One-time commits (CLAUDE.md): the UI shows a pending state from the tap, but nothing claims
// success until the server confirms.

export function useListForSale() {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: async (args: { itemId: string; quantity: number; askingPriceCents: number }) => {
      const { data, error } = await getSupabase().rpc('list_for_sale', {
        p_item_id: args.itemId,
        p_quantity: args.quantity,
        p_asking_price_cents: args.askingPriceCents,
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
    onError: (error, vars) => reportError({ context: 'useListForSale', error, metadata: { vars } }),
  })
}

export function useUnlistItem() {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await getSupabase().rpc('unlist_item', { p_item_id: itemId })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
    onError: (error, itemId) =>
      reportError({ context: 'useUnlistItem', error, metadata: { itemId } }),
  })
}

export function useSetAskingPrice() {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: async (args: { itemId: string; askingPriceCents: number }) => {
      const { data, error } = await getSupabase().rpc('set_asking_price', {
        p_item_id: args.itemId,
        p_asking_price_cents: args.askingPriceCents,
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
    onError: (error, vars) =>
      reportError({ context: 'useSetAskingPrice', error, metadata: { vars } }),
  })
}
