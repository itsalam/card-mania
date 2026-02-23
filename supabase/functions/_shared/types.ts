import { Database } from '@schema'

export type ImageItem = {
  sourceUrl: string
  width?: number
  height?: number
  source?: string
  storagePath?: string // public Storage URL if cached
  storageUrl?: string // bucket/path
  contentType?: string
  bytes?: number
}

export type CdnVariant = 'raw' | 'tiny' | 'thumb' | 'detail' | 'full'
export type CdnShape = 'original' | 'card' | 'square'
export type CdnFit = 'cover' | 'contain' // 'cover' crops to fill; 'contain' letterboxes

export type CdnOpts = {
  variant?: CdnVariant // preset size
  shape?: CdnShape // force aspect if not 'original'
  fit?: CdnFit // default cover for 'card', contain for 'square'
  width?: number // override preset width
  height?: number // override preset height
  quality?: number // default depends on variant
  bucket?: string // default "images"
}

export type SerpImageResults = {
  position: number
  thumbnail: string
  related_content_id: string
  serpapi_related_content_link: string
  source: string
  source_logo: string
  title: string
  link: string
  original: string
  original_width: number
  original_height: number
  is_product: boolean
}

export type PriceChartingEntry = {
  id: string
  name: string
  set: string
  latestPrice: number | null
  gradesPrices: Record<string, number>
  genre: string
  lastUpdated: string
  releaseDate: string
}

export type ImageHint = {
  kind: 'bound' | 'candidate'
  url: string | null
  query_hash?: string
}

export type Card = {
  id: string
  name: string
  set_name: string
  latest_price: number | null
  grades_prices: Record<string, number>
  genre?: string
  last_updated?: string
  release_date?: string
  image?: ImageHint
}

export type BlendedSearchResultItem = {
  id: string
  name: string
  set_name: string
  latest_price: number | null
  snippet: string
  score: number
  reason: any
}

export type SearchResultItem = {
  // core card-ish fields every source can provide
  id: string
  card: Card

  // ranking/meta (same for both sources)
  score: number
  snippet?: string
  reason?: any
  source: 'local' | 'vendor'
}

export type CardImageFields = Database['public']['Tables']['card_images']['Row']

export type Candidate = {
  id: string
  bytes: number
  width: number
  height: number
  contentType: string
  sourceUrl: string
}
