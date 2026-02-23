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

export const PriceChartingResponse = z
  .array(z.record(PriceDataKeys, z.union([z.number(), z.string()])))
  .optional()

export type TPriceChartingReq = z.infer<typeof PriceChartingRequest>
export type TPriceChartingRes = z.infer<typeof PriceChartingResponse>
