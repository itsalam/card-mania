import { OfferItem, TransactionStatus, TransactionWithOffer } from '@/client/offers/types'
import { ShippingAddress } from '@/client/transactions/types'
import { getSupabase } from '@/lib/store/client'
import { requireUser } from '@/lib/store/functions/helpers'
import { reportError } from '@/lib/utils/report-error'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

export function useTransaction(offerId: string | undefined) {
  return useQuery({
    queryKey: ['transaction', offerId] as const,
    enabled: Boolean(offerId),
    queryFn: async (): Promise<TransactionWithOffer> => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('transactions')
        .select('*, offer:offers(*, offer_items(*))')
        .eq('offer_id', offerId!)
        .single()
      if (error || !data) throw error ?? new Error('Transaction not found')
      return data as unknown as TransactionWithOffer
    },
  })
}

export function useUpdateTransactionStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ offerId, status }: { offerId: string; status: TransactionStatus }) => {
      const supabase = getSupabase()

      const { data, error } = await supabase
        .from('transactions')
        .update({ status })
        .eq('offer_id', offerId)
        .select()
        .single()

      if (error || !data) throw error ?? new Error('Failed to update transaction')

      if (status === 'completed') {
        const { error: offerError } = await supabase
          .from('offers')
          .update({ status: 'completed' })
          .eq('id', offerId)
        if (offerError) throw offerError
      }

      return data
    },
    onSuccess: (_data, { offerId }) => {
      qc.invalidateQueries({ queryKey: ['transaction', offerId] })
      qc.invalidateQueries({ queryKey: ['offers'] })
    },
    onError: (err, vars) => {
      reportError({ context: 'useUpdateTransactionStatus', error: err, metadata: { vars } })
    },
  })
}

export function useConfirmShippingAddress() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ offerId, address }: { offerId: string; address: ShippingAddress }) => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('transactions')
        .update({ buyer_shipping_address: address as any })
        .eq('offer_id', offerId)
        .select()
        .single()
      if (error || !data) throw error ?? new Error('Failed to save shipping address')
      return data
    },
    onSuccess: (_data, { offerId }) => {
      qc.invalidateQueries({ queryKey: ['transaction', offerId] })
    },
    onError: (err, vars) => {
      reportError({
        context: 'useConfirmShippingAddress',
        error: JSON.stringify(err, null, 2),
        metadata: { vars },
      })
    },
  })
}

export function useAddOfferItemsToCollection() {
  return useMutation({
    mutationFn: async ({ items }: { items: OfferItem[] }) => {
      const user = await requireUser()
      const supabase = getSupabase()

      // Find the user's vault collection
      const { data: vault, error: vaultErr } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_vault', true)
        .maybeSingle()
      if (vaultErr) throw vaultErr
      if (!vault) throw new Error('No vault collection found')

      for (const item of items) {
        const cardId = item.card_snapshot?.card_id
        if (!cardId) continue

        // Ensure the card stub exists so FK is satisfied
        await supabase.rpc('ensure_card_stub', {
          p_id: cardId as any,
          p_name: item.card_snapshot?.title ?? '',
          p_set_name: '',
          p_genre: 'trading_card' as any,
          p_grades_prices: {} as any,
          p_latest_price: null,
          p_image_url: item.card_snapshot?.image_url ?? null,
        })

        await supabase.from('collection_items').insert({
          collection_id: vault.id,
          ref_id: cardId,
          user_id: user.id,
          quantity: item.quantity,
          item_kind: 'card',
        })
      }
    },
    onError: (err) => {
      reportError({ context: 'useAddOfferItemsToCollection', error: err })
    },
  })
}

export function useRemoveOfferItemsFromCollection() {
  return useMutation({
    mutationFn: async ({ items }: { items: OfferItem[] }) => {
      const user = await requireUser()
      const supabase = getSupabase()

      const { data: vault, error: vaultErr } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_vault', true)
        .maybeSingle()
      if (vaultErr) throw vaultErr
      if (!vault) throw new Error('No vault collection found')

      for (const item of items) {
        const cardId = item.card_snapshot?.card_id
        if (!cardId) continue

        const { data: existing } = await supabase
          .from('collection_items')
          .select('id, quantity')
          .eq('collection_id', vault.id)
          .eq('ref_id', cardId)
          .maybeSingle()

        if (!existing) continue

        const newQty = existing.quantity - item.quantity
        if (newQty <= 0) {
          await supabase.from('collection_items').delete().eq('id', existing.id)
        } else {
          await supabase.from('collection_items').update({ quantity: newQty }).eq('id', existing.id)
        }
      }
    },
    onError: (err) => {
      reportError({ context: 'useRemoveOfferItemsFromCollection', error: err })
    },
  })
}

export function useMyTransactions(role: 'buyer' | 'seller') {
  return useQuery({
    queryKey: ['transactions', role] as const,
    queryFn: async (): Promise<TransactionWithOffer[]> => {
      const user = await requireUser()
      const supabase = getSupabase()
      const column = role === 'buyer' ? 'buyer_id' : 'seller_id'
      const { data, error } = await supabase
        .from('transactions')
        .select('*, offer:offers!inner(*, offer_items(*))')
        .eq(`offer.${column}`, user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as TransactionWithOffer[]
    },
  })
}

export function useTransactionStatusRealtime(offerId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!offerId) return

    const supabase = getSupabase()
    const channel = supabase
      .channel(`transaction-status-${offerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `offer_id=eq.${offerId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['transaction', offerId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [offerId, qc])
}
