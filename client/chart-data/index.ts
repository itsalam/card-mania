import { TCard } from '@/constants/types'
import { qk } from '@/lib/store/functions/helpers'
import { Json } from '@/lib/store/supabase'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { invokeFx } from '../helper'
import { PriceChartingRequest, PriceChartingResponse, TPriceChartingRes } from './types'

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
  const sortedGrades = [...grades].sort()

  return useQuery({
    queryKey: qk.priceQuery(card?.id, { grades: sortedGrades }),
    enabled: !!card?.id && grades.length > 0,
    queryFn: async () => {
      const promises = sortedGrades.map((grade) => {
        const payload = PriceChartingRequest.parse({
          card_id: card!.id,
          grade,
          mock_data: { end_cost: getField(card?.grades_prices || null, grade) },
        })
        return invokeFx<typeof payload, TPriceChartingRes>('price-fetch', payload, {
          method: 'POST',
          parseOut: PriceChartingResponse,
          useQueryParams: false,
        })
      })
      const resolvedPriceData = (await Promise.all<(typeof promises)[number]>(promises)) as {
        data: TPriceChartingRes
      }[]
      // Merge and sort all price data arrays by date
      const mergedPriceData = resolvedPriceData
        .reduce(
          (acc: Record<string, string | number>[], curr) => {
            if (!curr) return acc

            curr.data?.forEach((dataPoint) => {
              const existingIndex = acc.findIndex((x) => x.date === dataPoint.date)
              if (existingIndex >= 0) {
                // Merge data points with same date
                acc[existingIndex] = { ...acc[existingIndex], ...dataPoint }
              } else {
                acc.push(dataPoint)
              }
            })
            return acc
          },
          [] as Record<string, string | number>[]
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      return { priceData: mergedPriceData }
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000 * 5,
    gcTime: 60_000 * 5,
  })
}
