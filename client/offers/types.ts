import { z } from 'zod'

export const OfferStatus = z.enum(['pending', 'accepted', 'declined', 'cancelled', 'completed'])
export type OfferStatus = z.infer<typeof OfferStatus>

export const TransactionStatus = z.enum(['pending', 'shipped', 'completed', 'disputed'])
export type TransactionStatus = z.infer<typeof TransactionStatus>

export const CardSnapshot = z.object({
  title: z.string().optional(),
  image_url: z.string().optional(),
  card_id: z.string().optional(),
})
export type CardSnapshot = z.infer<typeof CardSnapshot>

export const OfferItem = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  collection_item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  offered_price_per_unit: z.number(),
  card_snapshot: CardSnapshot.nullable(),
})
export type OfferItem = z.infer<typeof OfferItem>

export const Offer = z.object({
  id: z.string().uuid(),
  buyer_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  status: OfferStatus,
  buyer_note: z.string().nullable(),
  total_amount: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  offer_items: z.array(OfferItem).optional(),
})
export type Offer = z.infer<typeof Offer>

export const Transaction = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  status: TransactionStatus,
  created_at: z.string(),
  updated_at: z.string(),
})
export type Transaction = z.infer<typeof Transaction>

export type SubmitOfferPayload = {
  seller_id: string
  buyer_note?: string
  items: Array<{
    collection_item_id: string
    quantity: number
    offered_price_per_unit: number
    card_snapshot?: CardSnapshot
  }>
}
