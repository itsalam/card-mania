import { z } from 'zod'

export type PriceEntry = {
  id: string
  name: string
  set: string
  latestPrice: number | null
  gradesPrices: Record<string, number>
  genre: string
  lastUpdated: string
}

export type PriceChartingData = {
  date: string
  gradesPrices: Record<string, number>
}

export const Card = z.object({
  id: z.string(),
  name: z.string(),
  set_name: z.string().optional(),
  latest_price: z.number().nullable(),

  image: z.object({
    kind: z.enum(["bound", "candidate"]),
    url: z.string().nullable(),
    query_hash: z.string().optional(),
  }).optional(),

  front_image_id: z.string().optional().nullable(),
  back_image_id: z.string().optional().nullable(),
  extra_image_ids: z.array(z.string()).optional().nullable(),

  grades_prices: z.record(z.string(), z.number().nullable()),
  release_date: z.string().nullable(),
  genre: z.string().optional(),
  last_updated: z.string().optional(),
})

export type TCard = z.infer<typeof Card>