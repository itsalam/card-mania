import { ImageProxyOpts } from "@/client/image-proxy";
import { Database, Json } from "@/lib/store/supabase";
import { z } from "zod";

export const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(z.string(), JsonSchema), // keys are strings by default
  ])
);

export type PriceEntry = {
  id: string;
  name: string;
  set: string;
  latestPrice: number | null;
  gradesPrices: Record<string, number>;
  genre: string;
  lastUpdated: string;
};

export type PriceChartingData = {
  date: string;
  gradesPrices: Record<string, number>;
};

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

  grades_prices: JsonSchema,
  release_date: z.string().nullable(),
  genre: z.string().optional(),
  last_updated: z.string().optional(),
});

export const TCollection = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: z.enum(["public", "private", "unlisted"]),
  created_at: z.string(), // ISO timestamp
  updated_at: z.string(), // ISO timestamp
  cover_image_url: z.string().nullable(),
});

export const TCollectionTags = z.object({
  collection_id: z.string(),
  tag_id: z.string(),
  user_id: z.string(),
  created_at: z.string(), // ISO timestamp
});

export const Tag = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  created_at: z.string(), // ISO timestamp
  source: z.string().default("user"),
  curated_weight: z.number().default(1.0),
  is_active: z.boolean().default(true),
  approved_at: z.string().nullable(),
  popularity: z.number().int().default(0),
});

export type ItemKinds = Database["public"]["Enums"]["item_kind"];

export type ItemLike = {
  kind: ItemKinds;
  title: string;
  subHeading: string;
  imageProxyArgs: ImageProxyOpts;
  id: string;
};

export type TCard = z.infer<typeof Card>;
export type TCollection = z.infer<typeof TCollection>;
export type TCollectionTags = z.infer<typeof TCollectionTags>;
export type TTag = z.infer<typeof Tag>;
