import { FiltersKeys } from '@/features/mainSearchbar/components/filters/providers'
import { getSupabase } from '@/lib/store/client'
import { useDebounced } from '@/lib/utils'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { invokeFx } from '../helper'
import { SearchRequest, SearchResponse, TSearchRes } from './types'

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
      filters: {
        minPrice: params.filters?.priceRange?.min,
        maxPrice: params.filters?.priceRange?.max,
      },
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
        // cursor is a string offset; null means first page
        cursor: pageParam ?? null,
      })
      const { data } = await invokeFx<typeof payload, TSearchRes>('card-search', payload, {
        parseOut: SearchResponse,
        useQueryParams: true,
      })
      return data
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last, _, lastPageParam) => {
      if (last.results.length < 20) return undefined
      const currentOffset = lastPageParam ? parseInt(lastPageParam as string, 10) : 0
      return String(currentOffset + 20)
    },
    staleTime: 30_000,
  })
}

/**
 * Returns a suggestions query populated from the hottest recent search
 * recorded in the `search_queries` table, falling back to a hardcoded default.
 */
export function useSuggestionsFixed() {
  // Fetch the hottest recent query from the DB to use as the suggestion seed
  const hotQueryResult = useQuery({
    queryKey: ['hot-suggestion-query'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('search_queries')
        .select('query_raw')
        .order('hits', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || !data) return null
      return data.query_raw as string
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })

  const suggestionQ =
    hotQueryResult.data ??
    (process.env.EXPO_PUBLIC_DEFAULT_SUGGESTIONS_QUERY || 'baseball cards 2025 topps')

  const payload = SearchRequest.parse({
    q: suggestionQ,
    limit: 8,
    commit_images: 'true',
  })

  return useQuery({
    queryKey: ['card-search-suggestions', suggestionQ],
    enabled: Boolean(suggestionQ),
    queryFn: async () => {
      const { data, error } = await invokeFx<typeof payload, TSearchRes>('card-search', payload, {
        parseOut: SearchResponse,
        useQueryParams: true,
      })
      if (error) throw error
      return data
    },
    staleTime: 60_000,
    gcTime: 60_000 * 5,
  })
}
