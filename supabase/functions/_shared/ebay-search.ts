import { getEbayToken, searchEbayItems } from '@ebay-auth'
import { EbayItemSummary, SearchResultItem } from '@types'
import { sha256HexStr, vendorUUID } from '@utils'

export type EbayConfig = {
  base: string
  appId: string
  certId: string
  marketplace: string
}

/** Normalize eBay items into SearchResultItems + build a preknownHints map for image attachment. */
export async function convertEbayItems(items: EbayItemSummary[]): Promise<{
  results: SearchResultItem[]
  preknownHints: Map<string, { url: string; norm: string }>
}> {
  const preknownHints = new Map<string, { url: string; norm: string }>()

  const results = await Promise.all(
    items.map(async (item) => {
      const cardId = await vendorUUID('ebay', item.itemId)
      const price = item.price ? parseFloat(item.price.value) : null

      let imageHint: SearchResultItem['card']['image']
      const rawImageUrl = item.image?.imageUrl
      // Upgrade eBay image URLs to full-res (s-l1600) — Browse API may return thumbs
      const imageUrl = rawImageUrl
        ? rawImageUrl.replace(/\/thumbs\//, '/images/').replace(/s-l\d+(\.\w+)$/, 's-l1600$1')
        : undefined
      if (imageUrl) {
        const qHash = await sha256HexStr(`ebay:${item.itemId}`)
        preknownHints.set(qHash, {
          url: imageUrl,
          norm: `ebay:${item.itemId}`,
        })
        imageHint = { kind: 'candidate', url: imageUrl, query_hash: qHash }
      }

      return {
        id: item.itemId,
        card: {
          id: cardId,
          name: item.title,
          set_name: item.categories?.[0]?.categoryName ?? 'Trading Cards',
          latest_price: price,
          grades_prices: (price !== null ? { ungraded: price } : {}) as Record<string, number>,
          genre: 'trading_card',
          image: imageHint,
        },
        score: 0,
        snippet: item.title,
        source: 'vendor' as const,
      }
    })
  )

  return { results, preknownHints }
}

/** Fetch eBay listings and return normalized results + image hints. */
export async function fetchFromEbay(
  cfg: EbayConfig,
  q: string,
  limit: number
): Promise<{
  results: SearchResultItem[]
  preknownHints: Map<string, { url: string; norm: string }>
}> {
  const token = await getEbayToken(cfg.appId, cfg.certId, cfg.base)
  const items = await searchEbayItems(q, token, cfg.base, cfg.marketplace, limit)
  return convertEbayItems(items)
}

/** Check provider_search_cache for a cached eBay response. */
export async function fetchEbayProviderCache(supa: string, srole: string, queryHash: string) {
  let cacheHit = false
  let results: SearchResultItem[] = []
  const preknownHints = new Map<string, { url: string; norm: string }>()
  const provider_query_key = await sha256HexStr(`ebay:${queryHash}`)
  const cacheUrl =
    `${supa}/rest/v1/provider_search_cache?provider_query_key=eq.${encodeURIComponent(
      provider_query_key
    )}` + `&provider=eq.ebay&select=normalized_items,expires_at`
  const check = await fetch(cacheUrl, {
    headers: { apikey: srole, authorization: `Bearer ${srole}` },
  })
  const rows = (await check?.json()) as
    Array<{ normalized_items: string; expires_at: string }> | undefined
  const row = rows?.[0]
  const fresh = row && new Date(row.expires_at).getTime() > Date.now()
  if (check.ok && row && fresh) {
    cacheHit = true
    results = JSON.parse(row.normalized_items) as SearchResultItem[]
    // Rebuild preknownHints from stored image data (raw eBay URLs are in card.image.url)
    for (const r of results) {
      const img = r.card.image
      if (img?.query_hash && img?.url) {
        preknownHints.set(img.query_hash, {
          url: img.url,
          norm: `ebay:${r.id}`,
        })
      }
    }
  }
  return { cacheHit, results, preknownHints, provider_query_key }
}

/** Persist eBay results into provider_search_cache, awaiting the write. */
export async function writeEbayProviderCache(
  supa: string,
  srole: string,
  provider_query_key: string,
  results: SearchResultItem[],
  ttlSeconds: number
): Promise<Response> {
  return fetch(`${supa}/rest/v1/provider_search_cache`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: srole,
      authorization: `Bearer ${srole}`,
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      provider: 'ebay',
      provider_query_key,
      normalized_items: JSON.stringify(results),
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    }),
  })
}

/** Persist eBay results into provider_search_cache (fire-and-forget). */
export function upsertEbayProviderCache(
  supa: string,
  srole: string,
  provider_query_key: string,
  results: SearchResultItem[],
  ttlSeconds: number
) {
  EdgeRuntime.waitUntil(
    writeEbayProviderCache(supa, srole, provider_query_key, results, ttlSeconds).catch((err) =>
      console.error('eBay provider cache upsert error', err)
    )
  )
}

/** Persist a single image hint into image_search_cache, awaiting the write. */
export async function writeImageSearchCacheHint(
  supa: string,
  srole: string,
  queryHash: string,
  hint: { url: string; norm: string }
): Promise<Response> {
  return fetch(`${supa}/rest/v1/image_search_cache`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: srole,
      authorization: `Bearer ${srole}`,
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([
      {
        query_hash: queryHash,
        query_norm: hint.norm,
        candidates: [{ id: queryHash, sourceUrl: hint.url }],
        top_url: hint.url,
        ttl_seconds: 7 * 24 * 3600,
        updated_at: new Date().toISOString(),
      },
    ]),
  })
}
