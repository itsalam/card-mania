import { fetchCardHedgeResults } from '@cardhedge'
import { CardHedgeCard, SearchResultItem } from '@types'
import { sha256HexStr, vendorUUID } from '@utils'
import { canonicalGradeKey } from '@grade-key'

export type CardHedgeConfig = {
  apiBase: string
  apiKey: string
}

/** Normalize CardHedge cards into SearchResultItems + build a preknownHints map. */
export async function convertCardHedgeItems(cards: CardHedgeCard[]): Promise<{
  results: SearchResultItem[]
  preknownHints: Map<string, { url: string; norm: string }>
}> {
  const preknownHints = new Map<string, { url: string; norm: string }>()

  const results = await Promise.all(
    cards.map(async (card) => {
      const cardId = await vendorUUID('cardhedge', card.card_id)

      // Build grades_prices map from the prices array
      const grades_prices: Record<string, number> = {}
      let latest_price: number | null = null
      if (card.prices) {
        for (const { grade, price } of card.prices) {
          const val = parseFloat(price) * 100
          if (!isNaN(val)) grades_prices[canonicalGradeKey(grade)] = val
        }
        // Use the Raw grade price as latest_price, or the lowest available
        const rawEntry = card.prices.find((p) => p.grade.toLowerCase() === 'raw')
        if (rawEntry) {
          latest_price = parseFloat(rawEntry.price) || null
        } else if (card.prices.length) {
          const vals = Object.values(grades_prices).filter((v) => v > 0)
          latest_price = vals.length ? Math.min(...vals) : null
        }
      }

      let imageHint: SearchResultItem['card']['image']
      if (card.image) {
        // Protocol-relative URLs (//s3.amazonaws.com/...) → prefix with https:
        const imageUrl = card.image.startsWith('//') ? `https:${card.image}` : card.image
        const qHash = await sha256HexStr(`cardhedge:${card.card_id}`)
        preknownHints.set(qHash, {
          url: imageUrl,
          norm: `cardhedge:${card.card_id}`,
        })
        imageHint = { kind: 'candidate', url: imageUrl, query_hash: qHash }
      }

      return {
        id: card.card_id,
        card: {
          id: cardId,
          name: card.description,
          set_name: card.set,
          latest_price,
          grades_prices,
          genre: card.category ?? 'trading_card',
          image: imageHint,
        },
        score: 0,
        snippet: `${card.set} • ${card.description}`,
        source: 'vendor' as const,
        reason: {
          sales_7day: card['7 Day Sales'],
          sales_30day: card['30 Day Sales'],
          gain: card.gain,
          rookie: card.rookie,
          variant: card.variant,
          player: card.player,
        },
      }
    })
  )

  return { results, preknownHints }
}

/** Fetch CardHedge listings and return normalized results + image hints. */
export async function fetchFromCardHedge(
  cfg: CardHedgeConfig,
  q: string,
  limit: number
): Promise<{
  results: SearchResultItem[]
  preknownHints: Map<string, { url: string; norm: string }>
}> {
  const cards = await fetchCardHedgeResults(q, cfg.apiKey, cfg.apiBase, limit)
  const sportsCards = cards.filter((c) => c.category_group === 'Sports Cards')
  return convertCardHedgeItems(sportsCards)
}

/** Check provider_search_cache for a cached CardHedge response. */
export async function fetchCardHedgeProviderCache(supa: string, srole: string, queryHash: string) {
  let cacheHit = false
  let results: SearchResultItem[] = []
  const preknownHints = new Map<string, { url: string; norm: string }>()
  const provider_query_key = await sha256HexStr(`cardhedge:${queryHash}`)
  const cacheUrl =
    `${supa}/rest/v1/provider_search_cache?provider_query_key=eq.${encodeURIComponent(
      provider_query_key
    )}` + `&provider=eq.cardhedge&select=normalized_items,expires_at`
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
    for (const r of results) {
      const img = r.card.image
      if (img?.query_hash && img?.url) {
        preknownHints.set(img.query_hash, {
          url: img.url,
          norm: `cardhedge:${r.id}`,
        })
      }
    }
  }
  return { cacheHit, results, preknownHints, provider_query_key }
}

/** Persist CardHedge results into provider_search_cache, awaiting the write. */
export async function writeCardHedgeProviderCache(
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
      provider: 'cardhedge',
      provider_query_key,
      normalized_items: JSON.stringify(results),
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    }),
  })
}

/** Persist CardHedge results into provider_search_cache (fire-and-forget). */
export function upsertCardHedgeProviderCache(
  supa: string,
  srole: string,
  provider_query_key: string,
  results: SearchResultItem[],
  ttlSeconds: number
) {
  EdgeRuntime.waitUntil(
    writeCardHedgeProviderCache(supa, srole, provider_query_key, results, ttlSeconds).catch((err) =>
      console.error('CardHedge provider cache upsert error', err)
    )
  )
}
