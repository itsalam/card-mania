import { FiltersKeys } from '@/features/mainSearchbar/components/filters/providers'
import { getSupabase } from '@/lib/store/client'
import { useDebounced } from '@/lib/utils'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { invokeFx } from '../helper'
import { SearchRequest, SearchResponse, SearchScope, TSearchFilters, TSearchRes } from './types'

const PREFETCH_FLAG_KEY = 'search-prefetch-enabled'
const PREFETCH_FLAG_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Report a measured search render time to the server (fire-and-forget).
 * The server inserts the sample and returns the current aggregate-driven
 * prefetch_enabled flag, which we cache locally for use on the next app start.
 */
export async function reportSearchRenderMs(ms: number): Promise<void> {
  try {
    console.debug('Search time: ', ms)
    const { data } = await invokeFx<{ render_ms: number }, { prefetch_enabled: boolean }>(
      'report-search-perf',
      { render_ms: Math.round(ms) },
      { method: 'POST' }
    )
    await AsyncStorage.setItem(
      PREFETCH_FLAG_KEY,
      JSON.stringify({ enabled: data.prefetch_enabled, ts: Date.now() })
    )
  } catch {
    // non-critical — silently ignore network or parse errors
  }
}

/**
 * Read the locally cached prefetch_enabled flag. Returns false if absent or stale
 * (older than 1 hour). The cache is refreshed whenever reportSearchRenderMs runs.
 */
export async function getCachedPrefetchEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PREFETCH_FLAG_KEY)
    if (!raw) return false
    const { enabled, ts } = JSON.parse(raw) as { enabled: boolean; ts: number }
    if (Date.now() - ts > PREFETCH_FLAG_TTL_MS) return false
    return Boolean(enabled)
  } catch {
    return false
  }
}

export function prefetchSuggestions(queryClient: QueryClient, q = ''): Promise<void> {
  const payload = SearchRequest.parse({ q, limit: 8, commit_images: 'true' })
  return queryClient.prefetchQuery({
    queryKey: ['price-charting-suggestions', q],
    queryFn: async () => {
      const { data } = await invokeFx<typeof payload, TSearchRes>('price-charting', payload, {
        parseOut: SearchResponse,
        useQueryParams: true,
      })
      return data
    },
    staleTime: 60_000,
  })
}

/**
 * Returns the currently active suggestion keyword from search_config.
 * Cached for 1 hour — refreshes when the cron advances the rotation index.
 */
type SuggestionConfig = { suggestion_queries: string[]; suggestion_query_idx: number }

/**
 * Returns the currently active suggestion keyword from search_config.
 * Cached for 1 hour — refreshes when the cron advances the rotation index.
 */
export function useSuggestionQuery(): string | undefined {
  const { data } = useQuery({
    queryKey: ['search-config-suggestion'],
    queryFn: async () => {
      // Cast required until supabase types are regenerated after the migration
      const { data } = await (getSupabase() as any)
        .from('search_config')
        .select('suggestion_queries, suggestion_query_idx')
        .eq('id', 1)
        .single()
      return (data ?? null) as SuggestionConfig | null
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
  if (!data?.suggestion_queries?.length) return undefined
  return data.suggestion_queries[data.suggestion_query_idx] ?? data.suggestion_queries[0]
}

export type FilterQuery = Partial<Record<FiltersKeys, string>> & {
  itemTypes?: string[]
  priceRange?: { min: number | undefined; max: number | undefined }
  // ITS-77 filter axes (populated by the filter store; see filters/providers)
  genre?: string
  sets?: string[]
  grading?: string[]
  sealed?: boolean
}

// Map the client filter store shape → the edge-function wire contract
// (SearchFilters). Only defined keys are sent, so the RPC's `IS NULL` guards
// leave unset filters unconstrained.
function toWireFilters(f?: FilterQuery): TSearchFilters | undefined {
  if (!f) return undefined
  const wire: TSearchFilters = {}
  if (f.genre) wire.genre = f.genre
  if (f.sets?.length) wire.sets = f.sets
  if (f.grading?.length) wire.grading = f.grading
  if (typeof f.sealed === 'boolean') wire.sealed = f.sealed
  if (f.priceRange?.min != null) wire.minPrice = f.priceRange.min
  if (f.priceRange?.max != null) wire.maxPrice = f.priceRange.max
  return Object.keys(wire).length ? wire : undefined
}

export function useCardSearch(params: {
  q: string
  scope?: SearchScope
  filters?: FilterQuery
  limit?: number
}) {
  const debouncedQ = useDebounced(params.q, 250)
  const scope: SearchScope = params.scope ?? 'catalog'

  // Marketplace scope lists live storefront items even with an empty query;
  // catalog scope still requires 2+ chars to avoid unbounded catalog scans.
  const enabled = scope === 'marketplace' || debouncedQ.trim().length >= 2
  const wireFilters = useMemo(() => toWireFilters(params.filters), [params.filters])
  const payloadBase = useMemo(
    () => ({
      q: debouncedQ,
      scope,
      filters: wireFilters ?? {},
      limit: params.limit ?? 20,
    }),
    [debouncedQ, scope, wireFilters, params.limit]
  )

  console.log({ payloadBase })

  return useInfiniteQuery<TSearchRes>({
    queryKey: ['card-search', payloadBase],
    enabled,
    queryFn: async ({ pageParam }) => {
      const payload = SearchRequest.parse({
        ...payloadBase,
        cursor: pageParam ?? null,
      })
      const { data } = await invokeFx<typeof payload, TSearchRes>('price-charting', payload, {
        parseOut: SearchResponse,
        useQueryParams: true,
      })
      return data
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => {
      return last.results.length >= 20 ? 'more' : undefined
    },
    staleTime: 30_000,
  })
}

export type GenreOption = { genre: string; n: number }
export type SetOption = { set_name: string; n: number }

// ITS-91: genre-first chip row. Distinct *canonical* genres (list_card_genres
// applies canonical_genre() so "Baseball Cards"/"Baseball" collapse to one chip).
// `as any` on the RPC name: these RPCs aren't in the generated types until the
// migration is pushed + `npm run db:types` re-runs (matches the codebase pattern).
export function useCardGenres() {
  return useQuery<GenreOption[]>({
    queryKey: ['card-genres'],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('list_card_genres' as any)
      console.log({ data, error })
      if (error) throw error
      return (data ?? []) as GenreOption[]
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })
}

// ITS-91: set multi-select. Optionally scoped to the selected canonical genre so
// the list stays bounded once a genre chip is active.
export function useCardSets(genre?: string | null) {
  return useQuery<SetOption[]>({
    queryKey: ['card-sets', genre ?? null],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc(
        'list_card_sets' as any,
        genre ? { p_genre: genre } : ({} as any)
      )
      if (error) throw error
      return (data ?? []) as SetOption[]
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })
}

export function useSuggestionsFixed() {
  const activeQuery = useSuggestionQuery()
  const q = activeQuery ?? ''
  return useQuery({
    queryKey: ['price-charting-suggestions', q],
    enabled: true,
    queryFn: async () => {
      const payload = SearchRequest.parse({ q, limit: 8, commit_images: 'true' })
      const { data } = await invokeFx<typeof payload, TSearchRes>('price-charting', payload, {
        parseOut: SearchResponse,
        useQueryParams: true,
      })
      return data
    },
    staleTime: 60_000,
    gcTime: 60_000 * 5,
  })
}
