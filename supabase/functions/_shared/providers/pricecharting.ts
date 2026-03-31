import { PriceChartingEntry, SearchResultItem } from '@types'
import { vendorUUID } from '@utils'

const PROVIDER = 'pricecharting'

export type PriceChartingFilters = {
  sport?: string
  minPrice?: number
  maxPrice?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Field mapping
// PriceCharting trading card API uses `grade-price-{n}` for graded values.
// ---------------------------------------------------------------------------

export function convertToPriceEntry(data: any): PriceChartingEntry {
  return {
    id: String(data.id),
    name: data['product-name'] ?? 'Unknown',
    set: data['console-name'] ?? 'other',
    latestPrice: data['loose-price'] ?? data.latestPrice ?? null,
    gradesPrices: {
      psa10: data['grade-price-10'] ?? null,
      psa9_5: data['grade-price-9-5'] ?? null,
      psa9: data['grade-price-9'] ?? null,
      psa8: data['grade-price-8'] ?? null,
      psa7: data['grade-price-7'] ?? null,
      cgc10: data['condition-17-price'] ?? null,
      sgc10: data['condition-18-price'] ?? null,
      ungraded: data['loose-price'] ?? null,
    },
    releaseDate: data['release-date'] ?? null,
    genre: data.genre ?? 'other',
    lastUpdated: data.updatedAt ?? new Date().toISOString(),
  }
}

export async function convertPCEntryToSearchItem(p: PriceChartingEntry): Promise<SearchResultItem> {
  return {
    id: p.id,
    card: {
      id: await vendorUUID(PROVIDER, p.id),
      name: p.name,
      set_name: p.set,
      latest_price: p.latestPrice,
      grades_prices: p.gradesPrices,
      genre: p.genre,
      last_updated: p.lastUpdated,
      release_date: p.releaseDate ?? null,
    },
    score: 0,
    snippet: `${p.set} • ${p.name}`,
    source: 'vendor',
  }
}

/**
 * Fetch search results from PriceCharting's product API.
 * Supports single-ID lookup (`id`) or keyword search (`q`).
 */
export async function searchPriceChartingListings(
  pcBase: string,
  pcKey: string,
  id: string | undefined,
  q: string | null,
  limit: string,
  filters: PriceChartingFilters
): Promise<{ raw: any; vendorResults: SearchResultItem[] }> {
  const url = new URL(`${pcBase}/api/product${id ? '' : 's'}`)
  url.searchParams.set('t', pcKey)
  if (id) url.searchParams.set('id', id)
  if (q) url.searchParams.set('q', q)
  // Map sport filter to PriceCharting's `genre` param
  if (filters.sport) url.searchParams.set('genre', filters.sport)

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`PriceCharting ${res.status}: ${res.statusText}`)

  const raw = await res.json()
  const priceEntries: PriceChartingEntry[] = id
    ? [convertToPriceEntry(raw)]
    : (raw.products ?? []).slice(0, parseInt(limit ?? '20')).map(convertToPriceEntry)

  const vendorResults = await Promise.all(priceEntries.map(convertPCEntryToSearchItem))
  return { raw, vendorResults }
}
