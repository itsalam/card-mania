import { z } from 'zod'

export const OfferStatus = z.enum([
  'pending',
  'countered',
  'accepted',
  'declined',
  'cancelled',
  'expired',
  'completed',
])
export type OfferStatus = z.infer<typeof OfferStatus>

export const TransactionStatus = z.enum(['pending', 'shipped', 'completed', 'disputed'])
export type TransactionStatus = z.infer<typeof TransactionStatus>

export const CardSnapshot = z.object({
  title: z.string().optional(),
  set_name: z.string().optional(),
  image_url: z.string().optional(),
  card_id: z.string().optional(),
  listing_price: z.number().optional(),
})
export type CardSnapshot = z.infer<typeof CardSnapshot>

export const OfferItem = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  collection_item_id: z.string().uuid().nullable(),
  quantity: z.number().int().positive(),
  offered_price_per_unit: z.number(),
  card_snapshot: CardSnapshot.nullable(),
})
export type OfferItem = z.infer<typeof OfferItem>

// ITS-142: each proposal (the original offer, then every counter) is one revision.
export const OfferRevision = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  author_id: z.string().uuid(),
  author_role: z.enum(['buyer', 'seller']),
  total_amount: z.number(),
  note: z.string().nullable(),
  created_at: z.string(),
})
export type OfferRevision = z.infer<typeof OfferRevision>

export const Offer = z.object({
  id: z.string().uuid(),
  buyer_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  status: OfferStatus,
  buyer_note: z.string().nullable(),
  total_amount: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  expires_at: z.string(),
  offer_items: z.array(OfferItem).optional(),
  offer_revisions: z.array(OfferRevision).optional(),
})
export type Offer = z.infer<typeof Offer>

export const Transaction = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  status: TransactionStatus,
  buyer_shipping_address: z.unknown().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Transaction = z.infer<typeof Transaction>

export const TransactionWithOffer = Transaction.extend({
  offer: Offer.extend({ offer_items: z.array(OfferItem) }),
})
export type TransactionWithOffer = z.infer<typeof TransactionWithOffer>

export type SubmitOfferPayload = {
  seller_id: string
  buyer_note?: string
  total_amount?: number
  items: Array<{
    collection_item_id: string | null
    quantity: number
    offered_price_per_unit: number
    card_snapshot?: CardSnapshot
  }>
}
