import { FiltersKeys } from '@/features/mainSearchbar/components/filters/providers'
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

const SUGGESTIONS_PAYLOAD = SearchRequest.parse({
  q: 'baseball-cards-2025-topps',
  limit: 8,
  commit_images: 'true',
})

export function prefetchSuggestions(queryClient: QueryClient): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: ['price-charting-suggestions'],
    queryFn: async () => {
      const { data, error } = await invokeFx<typeof SUGGESTIONS_PAYLOAD, TSearchRes>(
        'price-charting',
        SUGGESTIONS_PAYLOAD,
        { parseOut: SearchResponse, useQueryParams: true }
      )
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  })
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
  return useQuery({
    queryKey: ['price-charting-suggestions'],
    enabled: true,
    queryFn: async () => {
      const { data, error } = await invokeFx<typeof SUGGESTIONS_PAYLOAD, TSearchRes>(
        'price-charting',
        SUGGESTIONS_PAYLOAD,
        { parseOut: SearchResponse, useQueryParams: true }
      )
      if (error) throw error
      return data
    },
    staleTime: 60_000,
    gcTime: 60_000 * 5,
  })
}
