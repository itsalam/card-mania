import { TransactionStatus, TransactionWithOffer } from '@/client/offers/types'
import { ShippingAddress } from '@/client/transactions/types'
import { getSupabase } from '@/lib/store/client'
import { qk, requireUser } from '@/lib/store/functions/helpers'
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
    mutationFn: async ({
      offerId,
      status,
    }: {
      offerId: string
      status: Exclude<TransactionStatus, 'pending'>
    }) => {
      // ITS-121: each transition is its own RPC that checks the caller (seller ships, buyer
      // confirms receipt, either disputes) and the current status. Confirming receipt also
      // completes the offer in the same transaction.
      const rpc = {
        shipped: 'mark_transaction_shipped',
        completed: 'confirm_transaction_receipt',
        disputed: 'dispute_transaction',
      } as const
      const { data, error } = await getSupabase().rpc(rpc[status], { p_offer_id: offerId })
      if (error || !data) throw error ?? new Error('Failed to update transaction')
      return data
    },
    onSuccess: (_data, { offerId, status }) => {
      qc.invalidateQueries({ queryKey: ['transaction', offerId] })
      qc.invalidateQueries({ queryKey: ['offers'] })
      // ITS-135: confirming receipt moves the cards into the buyer's Vault on the server.
      if (status === 'completed') qc.invalidateQueries({ queryKey: qk.collections })
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
      const { data, error } = await getSupabase().rpc('set_transaction_shipping_address', {
        p_offer_id: offerId,
        p_address: address,
      })
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
