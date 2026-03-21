import { getSupabase } from '@/lib/store/client'
import { requireUser } from '@/lib/store/functions/helpers'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useClearCart } from '@/features/cart/hooks'
import { Offer, OfferStatus, SubmitOfferPayload } from './types'

const offersQk = (role: 'buyer' | 'seller') => ['offers', role] as const

async function submitOfferFn(payload: SubmitOfferPayload): Promise<Offer> {
  const user = await requireUser()
  const supabase = getSupabase()

  const total_amount = payload.items.reduce(
    (sum, item) => sum + item.offered_price_per_unit * item.quantity,
    0
  )

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .insert({
      buyer_id: user.id,
      seller_id: payload.seller_id,
      buyer_note: payload.buyer_note ?? null,
      total_amount,
    })
    .select()
    .single()

  if (offerError || !offer) throw offerError ?? new Error('Failed to create offer')

  const offerItems = payload.items.map((item) => ({
    offer_id: offer.id,
    collection_item_id: item.collection_item_id,
    quantity: item.quantity,
    offered_price_per_unit: item.offered_price_per_unit,
    card_snapshot: item.card_snapshot ?? null,
  }))

  const { error: itemsError } = await supabase.from('offer_items').insert(offerItems)
  if (itemsError) throw itemsError

  return offer as unknown as Offer
}

export function useSubmitOffer() {
  const clearCart = useClearCart()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: submitOfferFn,
    onSuccess: () => {
      clearCart()
      qc.invalidateQueries({ queryKey: ['offers'] })
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
    mutationFn: async ({ offerId, status }: { offerId: string; status: OfferStatus }) => {
      const supabase = getSupabase()

      const { data: offer, error } = await supabase
        .from('offers')
        .update({ status })
        .eq('id', offerId)
        .select()
        .single()

      if (error || !offer) throw error ?? new Error('Failed to update offer status')

      if (status === 'accepted') {
        const { error: txError } = await supabase.from('transactions').insert({ offer_id: offerId })
        if (txError) throw txError
      }

      return offer as unknown as Offer
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] })
    },
  })
}
