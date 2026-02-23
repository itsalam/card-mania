// lib/cardSearch.types.ts
import { Card } from '@/constants/types'
import { z } from 'zod'

export const CardSearchItem = z.object({
  id: z.string(),

  score: z.number(),
  snippet: z.string().optional(),
  reason: z.any().optional(),
  source: z.enum(['local', 'vendor']),

  card: Card,
})

export const SearchRequest = z.object({
  q: z.string().trim().min(1),
  filters: z
    .object({
      sport: z.string().optional(),
      year: z.array(z.number()).optional(),
      set: z.array(z.string()).optional(),
      variant: z.array(z.string()).optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    })
    .partial()
    .optional(),
  limit: z.number().min(1).max(100).default(20),
  commit_images: z.string().optional(),
  cursor: z.string().nullish(), // opaque since your function decides
})

export const SearchResponse = z.object({
  query: z.string().trim().min(1),
  query_hash: z.string().trim().min(1),
  results: z.array(CardSearchItem),
})

export type TCardSearchItem = z.infer<typeof CardSearchItem>
export type TSearchReq = z.infer<typeof SearchRequest>
export type TSearchRes = z.infer<typeof SearchResponse>
