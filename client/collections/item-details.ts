// ITS-137: item attributes (cost basis, serial number, condition notes) and gain/loss.
// Decisions: docs/collections/item-attributes.md.
//   * Cost basis is per copy, in cents, and private to the owner (like condition notes).
//   * A serial number is public and only allowed on a row holding one copy.
//   * Mirrors (a listing's Selling / Vault rows) read and write through to the listing.

import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { reportError } from '@/lib/utils/report-error'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL

export type ItemDetails = {
  itemId: string
  rootId: string
  quantity: number
  serialNumber: string | null
  /** Per copy, in cents. Null when the owner hasn't entered one. */
  costBasisCents: number | null
  conditionNotes: string | null
  /** Market price of one copy for its grade, in cents (0 when there's none). */
  marketValueCents: number
  /** (market - cost) x quantity, or null without a cost basis. */
  unrealizedCents: number | null
}

export type PortfolioGain = {
  unrealizedCents: number
  costCents: number
  withCostQuantity: number
  withoutCostQuantity: number
  realizedCents: number
  realizedQuantity: number
  realizedWithoutCostQuantity: number
}

export const itemDetailsKey = (itemId?: string) =>
  [...qk.collections, 'item-details', itemId] as const
export const portfolioGainKey = [...qk.collections, 'gain'] as const

type ItemDetailsRow = {
  item_id: string
  root_id: string
  quantity: number
  serial_number: string | null
  cost_basis_cents: number | null
  condition_notes: string | null
  market_value_cents: number | null
  unrealized_cents: number | null
}

export function toItemDetails(row: ItemDetailsRow): ItemDetails {
  return {
    itemId: row.item_id,
    rootId: row.root_id,
    quantity: row.quantity ?? 0,
    serialNumber: row.serial_number ?? null,
    costBasisCents: row.cost_basis_cents ?? null,
    conditionNotes: row.condition_notes ?? null,
    marketValueCents: row.market_value_cents ?? 0,
    unrealizedCents: row.unrealized_cents == null ? null : Number(row.unrealized_cents),
  }
}

/** Unrealized gain for a row: (market - cost) x quantity, or null without a cost. */
export function unrealizedGain(args: {
  marketValueCents: number
  costBasisCents: number | null
  quantity: number
}) {
  if (args.costBasisCents == null) return null
  return (args.marketValueCents - args.costBasisCents) * Math.max(0, args.quantity)
}

/** Gain as a share of cost (0.25 = 25%), or null when there's no cost to compare with. */
export function gainRatio(gainCents: number | null, costCents: number | null) {
  if (gainCents == null || !costCents) return null
  return gainCents / costCents
}

/** "+$12.50", "−$3.00" (true minus sign) or "$0.00". */
export function formatGain(cents: number) {
  const abs = (Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (cents > 0) return `+$${abs}`
  if (cents < 0) return `−$${abs}`
  return `$${abs}`
}

/** "+25.0%", "−3.2%" or "0.0%". */
export function formatGainPercent(ratio: number) {
  const pct = Math.abs(ratio * 100).toFixed(1)
  if (ratio > 0) return `+${pct}%`
  if (ratio < 0) return `−${pct}%`
  return `${pct}%`
}

/** Trims a serial number; empty means none. */
export function normalizeSerial(input: string) {
  const s = input.trim()
  return s.length ? s : null
}

export function useItemDetails(itemId?: string, enabled = true) {
  return useQuery<ItemDetails | null>({
    enabled: Boolean(itemId) && enabled,
    queryKey: itemDetailsKey(itemId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('item_details', { p_item_id: itemId! })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return row ? toItemDetails(row as ItemDetailsRow) : null
    },
  })
}

export function usePortfolioGain() {
  return useQuery<PortfolioGain>({
    queryKey: portfolioGainKey,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('portfolio_gain')
      if (error) throw error
      const row = (Array.isArray(data) ? data[0] : data) ?? {}
      const n = (v: unknown) => Number(v ?? 0)
      return {
        unrealizedCents: n(row.unrealized_cents),
        costCents: n(row.cost_cents),
        withCostQuantity: n(row.with_cost_quantity),
        withoutCostQuantity: n(row.without_cost_quantity),
        realizedCents: n(row.realized_cents),
        realizedQuantity: n(row.realized_quantity),
        realizedWithoutCostQuantity: n(row.realized_without_cost_quantity),
      }
    },
  })
}

// Saving details is a form commit: the Save button shows a pending state from the tap, and the
// sheet closes once the server confirms (CLAUDE.md, one-time commit actions).
export function useSetItemDetails() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      itemId: string
      costBasisCents: number | null
      serialNumber: string | null
      conditionNotes: string | null
    }) => {
      const { data, error } = await getSupabase().rpc('set_item_details', {
        p_item_id: args.itemId,
        // Generated types mark function args non-null; null clears the field.
        p_cost_basis_cents: args.costBasisCents as number,
        p_serial_number: args.serialNumber ?? '',
        p_condition_notes: args.conditionNotes ?? '',
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return row ? toItemDetails(row as ItemDetailsRow) : null
    },
    onSuccess: (details, vars) => {
      if (details) qc.setQueryData(itemDetailsKey(vars.itemId), details)
      // Everything under qk.collections: other rows of the same chain, the portfolio gain,
      // and the collection rows (they show the serial number).
      qc.invalidateQueries({ queryKey: qk.collections })
      qc.invalidateQueries({ queryKey: [supabaseUrl, 'collection-item'] })
    },
    onError: (error, vars) =>
      reportError({ context: 'useSetItemDetails', error, metadata: { itemId: vars.itemId } }),
  })
}
