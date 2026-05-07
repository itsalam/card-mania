import { z } from 'zod'

export const TransactionMessage = z.object({
  id: z.string().uuid(),
  transaction_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  content: z.string(),
  created_at: z.string(),
})
export type TransactionMessage = z.infer<typeof TransactionMessage>

export const ShippingAddress = z.object({
  street: z.string(),
  apt: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  country: z.string(),
})
export type ShippingAddress = z.infer<typeof ShippingAddress>
