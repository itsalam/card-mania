import { FiltersKeys } from '@/features/mainSearchbar/components/filters/providers'
import { getSupabase } from '@/lib/store/client'
import { useDebounced } from '@/lib/utils'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { invokeFx } from '../helper'
import { SearchRequest, SearchResponse, TSearchRes } from './types'

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
      const { data, error } = await invokeFx<typeof payload, TSearchRes>(
        'price-charting',
        payload,
        { parseOut: SearchResponse, useQueryParams: true }
      )
      if (error) throw error
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

type FilterQuery = Partial<Record<FiltersKeys, string>> & {
  itemTypes: string[]
  priceRange: { min: number | undefined; max: number | undefined }
}

export function useCardSearch(params: { q: string; filters?: FilterQuery; limit?: number }) {
  const debouncedQ = useDebounced(params.q, 250)

  const enabled = debouncedQ.trim().length >= 2
  const payloadBase = useMemo(
    () => ({
      q: debouncedQ,
      filters: params.filters ?? {},
      limit: params.limit ?? 20,
    }),
    [debouncedQ, params.filters, params.limit]
  )

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
      return last.results.length < 20
    },
    staleTime: 30_000,
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
      const { data, error } = await invokeFx<typeof payload, TSearchRes>(
        'price-charting',
        payload,
        { parseOut: SearchResponse, useQueryParams: true }
      )
      if (error) throw error
      return data
    },
    staleTime: 60_000,
    gcTime: 60_000 * 5,
  })
}
