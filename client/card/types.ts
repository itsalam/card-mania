

// lib/cardSearch.types.ts
import { Card } from '@/constants/types';
import { z } from 'zod';

export const CardRequest = z.object({
  card_id: z.string(),
  card_hints: Card.optional(),
  populate: z.boolean().optional(),
})

export const CardResponse = z.object({
  data: Card.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})  

export type TCardReq = z.infer<typeof CardRequest>
export type TCardRes = z.infer<typeof CardResponse>
