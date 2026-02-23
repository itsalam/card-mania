import { FiltersKeys } from '@/features/mainSearchbar/components/filters/providers'
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
  // Variant A: call your Supabase Edge Function by name
  const payload = SearchRequest.parse({
    q: 'baseball-cards-2025-topps',
    limit: 8,
    commit_images: 'true',
  })
  return useQuery({
    queryKey: ['price-charting-suggestions'],
    enabled: true,
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
    gcTime: 60_000 * 5,
  })
}
