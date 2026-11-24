import { getSupabase } from '@/lib/store/client'
import { qk, requireUser } from '@/lib/store/functions/helpers'
import { useUserStore } from '@/lib/store/useUserStore'
import { reportError } from '@/lib/utils/report-error'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useClearCart } from '@/features/cart/hooks'
import { Offer, OfferStatus, SubmitOfferPayload } from './types'

const offersQk = (role: 'buyer' | 'seller') => ['offers', role] as const

// ITS-122: one RPC writes the offer and its items in a single transaction, checking that
// each item is the seller's and in stock.
async function submitOfferFn(payload: SubmitOfferPayload): Promise<Offer> {
  await requireUser()
  const supabase = getSupabase()

  const { data, error } = await supabase.rpc('create_offer', {
    p_seller_id: payload.seller_id,
    p_items: payload.items.map((item) => ({
      collection_item_id: item.collection_item_id,
      quantity: item.quantity,
      offered_price_per_unit: item.offered_price_per_unit,
      card_snapshot: item.card_snapshot ?? null,
    })),
    p_buyer_note: payload.buyer_note,
    p_total_amount: payload.total_amount,
  })

  if (error || !data) throw error ?? new Error('Failed to create offer')
  return data as unknown as Offer
}

export function useSubmitOffer() {
  const clearCart = useClearCart()
  const qc = useQueryClient()
  const userId = useUserStore((s) => s.user?.id)

  return useMutation({
    mutationFn: submitOfferFn,
    onSuccess: () => {
      clearCart()
      qc.invalidateQueries({ queryKey: ['offers'] })
      // ITS-100: sending an offer is one of the three activation conditions — refresh
      // the cached read rather than waiting out its staleTime. Receiving an offer is
      // covered separately by useOfferRealtime's notification handler.
      qc.invalidateQueries({ queryKey: qk.activationStatus(userId) })
    },
    onError: (err, vars) => {
      reportError({ context: 'useSubmitOffer', error: err, metadata: { vars } })
    },
  })
}

export function useMyOffers(role: 'buyer' | 'seller') {
  return useQuery({
    queryKey: offersQk(role),
    queryFn: async () => {
      const user = await requireUser()
      const supabase = getSupabase()

      const column = role === 'buyer' ? 'buyer_id' : 'seller_id'

      const { data, error } = await supabase
        .from('offers')
        .select('*, offer_items(*)')
        .eq(column, user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as unknown as Offer[]
    },
  })
}

export function useUpdateOfferStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      offerId,
      status,
    }: {
      offerId: string
      status: Extract<OfferStatus, 'accepted' | 'declined' | 'cancelled'>
    }): Promise<void> => {
      // ITS-121/122: status changes go through RPCs that check the caller and the
      // transition. accept_offer also creates the transaction, checks stock and declines
      // competing offers the remaining stock can't fill.
      const rpc = {
        accepted: 'accept_offer',
        declined: 'decline_offer',
        cancelled: 'cancel_offer',
      } as const
      const { error } = await getSupabase().rpc(rpc[status], { p_offer_id: offerId })
      if (error) throw error
    },
    onMutate: async ({ offerId, status }) => {
      await qc.cancelQueries({ queryKey: ['offers'] })
      const prevBuyer = qc.getQueryData<Offer[]>(offersQk('buyer'))
      const prevSeller = qc.getQueryData<Offer[]>(offersQk('seller'))

      const patch = (old: Offer[] | undefined) =>
        old?.map((o) => (o.id === offerId ? { ...o, status } : o))

      qc.setQueryData<Offer[]>(offersQk('buyer'), patch)
      qc.setQueryData<Offer[]>(offersQk('seller'), patch)

      return { prevBuyer, prevSeller }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prevBuyer) qc.setQueryData(offersQk('buyer'), ctx.prevBuyer)
      if (ctx?.prevSeller) qc.setQueryData(offersQk('seller'), ctx.prevSeller)
      reportError({ context: 'useUpdateOfferStatus', error: err, metadata: { vars } })
    },
    onSettled: () => {
      // Accepting can also decline competing offers and creates a transaction.
      qc.invalidateQueries({ queryKey: ['offers'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
