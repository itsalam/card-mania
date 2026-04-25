// lib/cardSearch.types.ts
import { z } from 'zod'

export const PriceChartingRequest = z.object({
  card_id: z.string(),
  grade: z.string(),
  mock_data: z
    .object({
      end_cost: z.number().nullish(),
    })
    .optional(),
})

const PriceDataKeys = z.enum(['date']).or(z.string())
const PriceDataArray = z.array(z.record(PriceDataKeys, z.union([z.number(), z.string()])))

// Pending shape: returned when no history exists yet and a backfill has been triggered.
const PricePendingResponse = z.object({
  pending: z.literal(true),
  data: z.array(z.never()),
})

export const PriceChartingResponse = z.union([PriceDataArray, PricePendingResponse]).optional()

export type TPriceChartingReq = z.infer<typeof PriceChartingRequest>
export type TPriceChartingRes = z.infer<typeof PriceChartingResponse>
export type TPricePending = z.infer<typeof PricePendingResponse>
