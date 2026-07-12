// lib/cardSearch.types.ts
import { Card } from '@/constants/types'
import { z } from 'zod'

export const CardSearchItem = z.object({
  id: z.string(),

  score: z.number(),
  rank: z.number().optional(),
  snippet: z.string().optional(),
  reason: z.any().optional(),
  source: z.enum(['local', 'vendor']),

  card: Card,
})

// Wire contract for the `price-charting` edge function. Kept in sync with the
// edge function (supabase/functions/price-charting/index.ts) AND the RPC filter
// params (search_cards_blended / search_storefront_items). ITS-77 unified these
// three layers — before, each disagreed and filters never reached the DB.
export const SearchFilters = z
  .object({
    genre: z.string().optional(), // cards.genre (the "sport"/category axis)
    sets: z.array(z.string()).optional(), // cards.set_name
    grading: z.array(z.string()).optional(), // grading-company slugs + 'raw' (marketplace scope)
    sealed: z.boolean().optional(), // cards.sealed
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
  })
  .partial()

export const SearchRequest = z.object({
  q: z.string().trim().min(0),
  scope: z.enum(['catalog', 'marketplace']).default('catalog'),
  filters: SearchFilters.optional(),
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
export type TSearchFilters = z.infer<typeof SearchFilters>
export type SearchScope = 'catalog' | 'marketplace'
