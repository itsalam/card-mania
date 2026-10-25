import { PriceChartingEntry, SearchResultItem } from '@types'
import { sha256HexStr, vendorUUID } from '@utils'

export const PRICECHARTING_PROVIDER = 'pricecharting'

export type PriceChartingConfig = {
  apiBase: string
  apiKey: string
}

export const convertToPriceEntry = (data: any): PriceChartingEntry => ({
  id: String(data.id),
  name: data['product-name'] ?? 'Unknown',
  set: data['console-name'] ?? 'other',
  latestPrice: data.latestPrice ?? null,
  gradesPrices: {
    psa10: data['manual-only-price'] ?? null,
    psa9_5: data['box-only-price'] ?? null,
    psa9: data['graded-price'] ?? null,
    psa8: data['new-price'] ?? null,
    psa7: data['cib-price'] ?? null,
    cgc10: data['condition-17-price'] ?? null,
    sgc10: data['condition-18-price'] ?? null,
    ungraded: data['loose-price'] ?? null,
  },
  releaseDate: data['release-date'] ?? null,
  genre: data.genre ?? 'other',
  lastUpdated: data.updatedAt ?? new Date().toISOString(),
})

export const convertPCEntrytoSearchItem = async (
  p: PriceChartingEntry
): Promise<SearchResultItem> => ({
  id: p.id,
  card: {
    id: await vendorUUID(PRICECHARTING_PROVIDER, p.id),
    name: p.name,
    set_name: p.set,
    latest_price: p.latestPrice,
    grades_prices: p.gradesPrices,
    genre: p.genre,
    last_updated: p.lastUpdated,
    release_date: p.releaseDate ?? null,
  },
  score: 0, // provisional; set later
  snippet: `${p.set} • ${p.name}`,
  source: 'vendor',
})

/** Check provider_search_cache for a cached PriceCharting response. */
export const fetchPriceChartingProviderCache = async (
  supa: string,
  srole: string,
  queryHash: string
) => {
  let cacheHit = false
  let vendorResults: SearchResultItem[] = []
  const provider_query_key = await sha256HexStr(`${PRICECHARTING_PROVIDER}:${queryHash}`)
  const cacheUrl = `${supa}/rest/v1/provider_search_cache?provider_query_key=eq.${encodeURIComponent(
    provider_query_key
  )}&select=normalized_items,expires_at`
  const check = await fetch(cacheUrl, {
    headers: { apikey: srole, authorization: `Bearer ${srole}` },
  })
  const rows = (await check?.json()) as
    Array<{ normalized_items: string; expires_at: string }> | undefined

  const row = rows?.[0]
  const fresh = row && new Date(row.expires_at).getTime() > Date.now()

  if (!check.ok) {
    console.log('Provider cache check error')
    console.log(check.status, check.statusText)
  } else if (row && fresh) {
    cacheHit = true
    console.log('Provider cache hit')
    console.log(row.normalized_items.slice(0, 400))
    vendorResults = JSON.parse(row.normalized_items) as SearchResultItem[] // <-- IMPORTANT: unwrap the data payload
  }

  return { cacheHit, vendorResults, provider_query_key }
}

/** Fetch PriceCharting listings and return normalized results. */
export const fetchFromPriceCharting = async (
  cfg: PriceChartingConfig,
  id: string | undefined,
  q: string | null,
  limit: string
) => {
  let vendorResults: SearchResultItem[] = []
  const pcBaseUrl = new URL(`${cfg.apiBase}/api/product${id ? '' : 's'}`)
  pcBaseUrl.searchParams.set('t', cfg.apiKey)
  if (id) {
    pcBaseUrl.searchParams.set('id', id)
  }
  if (q) {
    pcBaseUrl.searchParams.set('q', q)
  }
  const vendorUrl = pcBaseUrl.toString()

  const vres = await fetch(vendorUrl, {
    headers: { accept: 'application/json' },
  })
  if (!vres.ok) {
    console.error('Vendor fetch failed', { vendorUrl, status: vres.status })
    throw new Error(`Vendor ${vres.status}, ${vres.statusText}`)
  }
  const raw = await vres.json()

  const priceEntries: PriceChartingEntry[] = id
    ? [convertToPriceEntry(raw)]
    : raw.products
        .slice(0, parseInt(limit ?? '20'))
        .map((item: PriceChartingEntry) => convertToPriceEntry(item))

  vendorResults = await Promise.all(priceEntries.map(convertPCEntrytoSearchItem))

  return { raw, vendorResults }
}

/** Persist PriceCharting results into provider_search_cache, awaiting the write. */
export const writePriceChartingProviderCache = async (
  supa: string,
  srole: string,
  provider_query_key: string,
  raw: string | undefined,
  vendorResults: SearchResultItem[],
  ttlSeconds: number
): Promise<Response> => {
  return fetch(`${supa}/rest/v1/provider_search_cache`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: srole,
      authorization: `Bearer ${srole}`,
    },
    body: JSON.stringify({
      provider: PRICECHARTING_PROVIDER,
      provider_query_key,
      raw_payload: raw,
      normalized_items: vendorResults,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    }),
  })
}

/** Persist PriceCharting results into provider_search_cache (fire-and-forget). */
export const upsertProviderCache = (
  supa: string,
  srole: string,
  provider_query_key: string,
  raw: string | undefined,
  vendorResults: SearchResultItem[],
  ttlSeconds: number
) => {
  EdgeRuntime.waitUntil(
    writePriceChartingProviderCache(
      supa,
      srole,
      provider_query_key,
      raw,
      vendorResults,
      ttlSeconds
    ).catch((err) => console.error('PriceCharting provider cache upsert error', err))
  )
}
