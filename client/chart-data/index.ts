import { TCard } from '@/constants/types'
import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { Json } from '@/lib/store/supabase'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { invokeFx } from '../helper'
import {
  PriceChartingRequest,
  PriceChartingResponse,
  TPriceChartingRes,
  TPricePending,
} from './types'

/**
 * Fire-and-forget price-fetch calls for each grade of a card.
 * price-fetch internally triggers fetch-card-history when no history exists,
 * so calling this early (e.g. on collection add) means history is already
 * being backfilled before the user opens the card detail view.
 */
export function prewarmPriceHistory(cardId: string, grades: string[]): void {
  if (!grades.length) return
  const supabase = getSupabase()
  grades.forEach((grade) => {
    supabase.functions
      .invoke('price-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId, grade }),
      })
      .catch(() => {}) // errors are benign — this is best-effort prefetching
  })
}

function getField(value: Json, key: string): Json | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    // Now TypeScript knows it's the object branch
    const obj = value as { [key: string]: Json | undefined }
    return obj[key]
  }

  return undefined
}

export function usePriceChartingData(params: { card: TCard; grade: string }) {
  const { card, grade } = params
  const payload = PriceChartingResponse.parse({
    cardId: card.id,
    grade,
    mock_data: { endCost: getField(card.grades_prices, grade) },
  })
  return useQuery({
    queryKey: qk.priceQuery(card.id, grade),
    enabled: true,
    queryFn: async () => {
      return await invokeFx<typeof payload, TPriceChartingRes>('price-fetch', payload, {
        parseOut: PriceChartingResponse,
        useQueryParams: false,
      })
    },
    staleTime: 60_000 * 5,
    gcTime: 60_000 * 5,
  })
}

export function usePriceChartingDataBatch(params: { card?: Partial<TCard>; grades: string[] }) {
  const { card, grades } = params

  // One cache entry per grade — toggling a grade never invalidates already-loaded grades.
  const results = useQueries({
    queries: grades.map((grade) => ({
      queryKey: qk.priceQuery(card?.id, grade),
      enabled: !!card?.id,
      queryFn: async () => {
        const payload = PriceChartingRequest.parse({ card_id: card!.id, grade })
        return invokeFx<typeof payload, TPriceChartingRes>('price-fetch', payload, {
          method: 'POST',
          parseOut: PriceChartingResponse,
          useQueryParams: false,
        })
      },
      placeholderData: keepPreviousData,
      staleTime: 60_000 * 5,
      gcTime: 60_000 * 5,
      refetchInterval: (query: { state: { data?: unknown } }) => {
        const d = query.state.data as { data?: TPricePending } | undefined
        return d?.data && !Array.isArray(d.data) && (d.data as TPricePending).pending === true
          ? 4_000
          : false
      },
    })),
  })

  const data = useMemo(() => {
    if (!grades.length) return undefined

    const isPending = results.some((r) => {
      const d = r.data as { data?: TPricePending } | undefined
      return d?.data && !Array.isArray(d.data) && (d.data as TPricePending).pending === true
    })

    const mergedPriceData = results
      .reduce((acc: Record<string, string | number>[], r) => {
        const payload = (r.data as { data?: TPriceChartingRes } | undefined)?.data
        if (!payload || !Array.isArray(payload)) return acc
        payload.forEach((dataPoint) => {
          const existingIndex = acc.findIndex((x) => x.date === dataPoint.date)
          if (existingIndex >= 0) {
            acc[existingIndex] = { ...acc[existingIndex], ...dataPoint }
          } else {
            acc.push(dataPoint)
          }
        })
        return acc
      }, [])
      .sort((a, b) => new Date(String(a.date)).getTime() - new Date(String(b.date)).getTime())

    return { priceData: mergedPriceData, pending: isPending }
  }, [results, grades])

  return {
    data,
    isLoading: results.some((r) => r.isLoading),
    isFetching: results.some((r) => r.isFetching),
    isError: results.some((r) => r.isError),
  }
}
