import { fetchCardHedgeTopMovers } from '@cardhedge'
import {
  convertCardHedgeItems,
  fetchCardHedgeProviderCache,
  fetchFromCardHedge,
  upsertCardHedgeProviderCache,
} from '@vendor-cardhedge-search'
import { fetchEbayProviderCache, fetchFromEbay, upsertEbayProviderCache } from '@ebay-search'
import {
  fetchFromPriceCharting,
  fetchPriceChartingProviderCache,
  PRICECHARTING_PROVIDER,
  upsertProviderCache,
} from '@pricecharting-search'
import { BlendedSearchResultItem, CardHedgeCard, SearchResultItem } from '@types'
import {
  buildSerpQuery,
  corsHeaders,
  createSupabaseServiceClient,
  fetchGlobalVars,
  normalize,
  sha256HexStr,
  vendorUUID,
} from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const supabase = createSupabaseServiceClient()

const HOT_THRESHOLD = Number(Deno.env.get('IMAGE_HOT_THRESHOLD') ?? '20')
const COOL_OFF_MS = Number(Deno.env.get('IMAGE_COOL_OFF_MS') ?? `${24 * 60 * 60 * 1000}`)
const PRICECHARTING_CACHE_TTL = Number(Deno.env.get('PRICECHARTING_CACHE_TTL') ?? '300')
const EBAY_CACHE_TTL = Number(Deno.env.get('EBAY_CACHE_TTL') ?? String(PRICECHARTING_CACHE_TTL))
const CARDHEDGE_CACHE_TTL = Number(
  Deno.env.get('CARDHEDGE_CACHE_TTL') ?? String(PRICECHARTING_CACHE_TTL)
)

// Vendor priority: lower number = higher trust. Exposed in result.reason.vendor_priority.
const VENDOR_PRIORITY = {
  local: 0,
  cardhedge: Number(Deno.env.get('CARDHEDGE_VENDOR_PRIORITY') ?? '1'),
  pricecharting: Number(Deno.env.get('PRICECHARTING_VENDOR_PRIORITY') ?? '2'),
  ebay: Number(Deno.env.get('EBAY_VENDOR_PRIORITY') ?? '3'),
} as const

const json = (v: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(v), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })

const mapLocalToResult = async (r: BlendedSearchResultItem): Promise<SearchResultItem> => ({
  id: r.id,
  card: {
    id: await vendorUUID(PRICECHARTING_PROVIDER, r.id),
    name: r.name,
    set_name: r.set_name,
    latest_price: r.latest_price ?? null,
    grades_prices: {},
    // genre: r.genre,
    // last_updated: r.last_updated,
    // release_date: r.release_date ?? null,
  },
  score: r.score,
  snippet: r.snippet,
  reason: { ...r.reason, policy: 'local' },
  source: 'local',
})

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  if (req.method === 'OPTIONS') {
    const headers = corsHeaders(origin)
    return new Response(null, {
      status: Object.keys(headers).length ? 204 : 403,
      headers,
    })
  }
  const inm = req.headers.get('if-none-match') ?? ''
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  let q: string | null = url.searchParams.get('q') || ''
  // When no query or ID is provided, fall back to the active suggestion keyword
  // from search_config so the response is always meaningful.
  if (!q.length && !id) {
    const { data: cfg } = await supabase
      .from('search_config')
      .select('suggestion_queries, suggestion_query_idx')
      .eq('id', 1)
      .single()
    if (cfg?.suggestion_queries?.length) {
      q = cfg.suggestion_queries[cfg.suggestion_query_idx] ?? cfg.suggestion_queries[0]
    }
  }
  const limit = url.searchParams.get('limit') ?? '20'
  const skipCache = url.searchParams.get('skipCache') === 'true'
  const cacheUpsert = (url.searchParams.get('skipCacheUpsert') ?? 'false') === 'false'

  const commitImages = Boolean(url.searchParams.get('commit_images'))

  // ITS-77: search scope + filters. `filters` arrives JSON-encoded in a query
  // param (invokeFx serializes object values with JSON.stringify).
  const scope =
    (url.searchParams.get('scope') ?? 'catalog') === 'marketplace' ? 'marketplace' : 'catalog'
  let filters: {
    genre?: string
    sets?: string[]
    grading?: string[]
    sealed?: boolean
    minPrice?: number
    maxPrice?: number
  } = {}
  try {
    const raw = url.searchParams.get('filters')
    if (raw) filters = JSON.parse(raw)
  } catch {
    filters = {}
  }

  const pcBase = Deno.env.get('PRICECHARTING_API_BASE')!
  const pcKey = Deno.env.get('PRICECHARTING_API_KEY')!
  const SCORE_THRESHOLD = Number(Deno.env.get('SCORE_THRESHOLD') ?? '0.35')
  const { supa, srole } = fetchGlobalVars()

  // eBay is optional — gracefully disabled when keys are absent
  const ebayBase = Deno.env.get('EBAY_API_BASE') ?? ''
  const ebayAppId = Deno.env.get('EBAY_APP_ID') ?? ''
  const ebayCertId = Deno.env.get('EBAY_CERT_ID') ?? ''
  const ebayMarketplace = Deno.env.get('EBAY_MARKETPLACE_ID') ?? 'EBAY_US'
  const ebayEnabled = Boolean(ebayBase && ebayAppId && ebayCertId)

  // CardHedge is optional — gracefully disabled when keys are absent
  const cardhedgeBase = Deno.env.get('CARDHEDGE_API_BASE') ?? ''
  const cardhedgeKey = Deno.env.get('CARDHEDGE_API_KEY') ?? ''
  const cardhedgeEnabled = Boolean(cardhedgeBase && cardhedgeKey)

  if (!pcBase || !pcKey || !supa || !srole) {
    return json({ error: 'Missing environment variables' }, { status: 500 })
  }

  // ITS-77: marketplace scope — search live storefront listings only, via the
  // search_storefront_items RPC. No vendor fallbacks (eBay/PriceCharting/
  // CardHedge) — those aren't items for sale. Lists all storefront items when
  // the query is empty.
  if (scope === 'marketplace') {
    const qNorm = q ? normalize(q) : ''
    const rows = await fetch(`${supa}/rest/v1/rpc/search_storefront_items`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: srole,
        authorization: `Bearer ${srole}`,
      },
      body: JSON.stringify({
        p_q: qNorm,
        p_limit: Number(limit ?? '20'),
        p_genre: filters.genre ?? null,
        p_sets: filters.sets ?? null,
        p_grading: filters.grading ?? null,
        p_min_price: filters.minPrice ?? null,
        p_max_price: filters.maxPrice ?? null,
        p_sealed: typeof filters.sealed === 'boolean' ? filters.sealed : null,
      }),
    })
      .then((r) => r.json() as Promise<Array<Record<string, any>>>)
      .catch((err) => {
        console.error('storefront search failed', err)
        return [] as Array<Record<string, any>>
      })

    const mapped: SearchResultItem[] = (Array.isArray(rows) ? rows : []).map((row) => ({
      id: String(row.id),
      card: {
        id: row.card_id,
        name: row.name,
        set_name: row.set_name,
        latest_price: row.price ?? null,
        grades_prices: {},
        genre: row.genre,
      },
      score: row.score ?? 1,
      snippet: row.snippet,
      source: 'local' as const,
      // Marketplace-specific fields the result row / renderAccessories consume.
      reason: {
        ...(row.reason ?? {}),
        policy: 'storefront',
        scope: 'marketplace',
        listing_id: row.id,
        seller_id: row.seller_id,
        seller_username: row.seller_username,
        price: row.price,
        grade_label: row.grade_label,
        grading_company: row.grading_company,
        sealed: row.sealed,
      },
    }))

    const withHints = await attachImageHints(mapped, supa, srole, new Map())
    const marketHash = await sha256HexStr(`market:${qNorm}:${JSON.stringify(filters)}`)
    return json(
      { query: q || 'marketplace', query_hash: marketHash, results: withHints },
      { headers: { 'Access-Control-Allow-Origin': cors.origin } }
    )
  }

  // No query and no id after config lookup — fall back to CardHedge top-movers
  if (!q?.length && !id) {
    if (!cardhedgeEnabled) {
      return json({ error: 'Missing id or q' }, { status: 400 })
    }
    try {
      const topMovers = await fetchCardHedgeTopMovers(cardhedgeKey, cardhedgeBase, Number(limit))
      const sportsCards = topMovers.filter(
        (c: CardHedgeCard) => c.category_group === 'Sports Cards'
      )
      const { results, preknownHints } = await convertCardHedgeItems(sportsCards)
      if (preknownHints.size > 0) upsertImageSearchCacheHints(preknownHints, supa, srole)
      const topMoversHash = await sha256HexStr('top-movers')
      return json({
        query: 'top-movers',
        query_hash: topMoversHash,
        results: results.slice(0, Number(limit)),
      })
    } catch (err) {
      console.error('top-movers fallback failed:', err)
      return json({ error: 'Missing id or q' }, { status: 400 })
    }
  }

  const cacheKey = id ? `id:${id}` : q ? `q:${q!.toLowerCase().trim()}` : null

  const queryNorm = q ? normalize(q) : id ? `id:${id}` : ''
  // Include filters in the cache key — otherwise changing genre/sets/price/sealed
  // hits the same query-only cache entry and the filtered RPC is never re-run
  // (mirrors the marketplace hash above).
  const queryHashPromise = sha256HexStr(`${queryNorm || cacheKey!}:${JSON.stringify(filters)}`)
  let queryHash
  if (!cacheKey) return json({ error: 'Missing id or q' }, { status: 400 })

  // Check cache
  let vendorResults: SearchResultItem[] = []
  let blendedResults: SearchResultItem[] = []
  let ebayResults: SearchResultItem[] = []
  let cardhedgeResults: SearchResultItem[] = []
  let vendorCacheHit = false
  let blendedCacheHit = false
  let ebayCacheHit = false
  let cardhedgeCacheHit = false
  let raw
  let provider_query_key
  let ebay_provider_query_key: string | undefined
  let cardhedge_provider_query_key: string | undefined
  let ebayPreknownHints: Map<string, { url: string; norm: string }> = new Map()
  let cardhedgePreknownHints: Map<string, { url: string; norm: string }> = new Map()
  if (!skipCache) {
    //Check blended Cache
    queryHash = await queryHashPromise
    const blendedCache = await fetchBlendedCache(supa, srole, queryHash)
    blendedCacheHit = blendedCache.cacheHit
    blendedResults = blendedCache.vendorResults
    if (!vendorResults.length) {
      const providerCache = await fetchPriceChartingProviderCache(supa, srole, queryHash)

      vendorCacheHit = providerCache.cacheHit
      vendorResults = providerCache.vendorResults
      provider_query_key = providerCache.provider_query_key
    }
    if (ebayEnabled && !blendedCacheHit) {
      const ebayCache = await fetchEbayProviderCache(supa, srole, queryHash)
      ebayCacheHit = ebayCache.cacheHit
      ebayResults = ebayCache.results
      ebay_provider_query_key = ebayCache.provider_query_key
      ebayPreknownHints = ebayCache.preknownHints
    }
    if (cardhedgeEnabled && !blendedCacheHit) {
      const cardhedgeCache = await fetchCardHedgeProviderCache(supa, srole, queryHash)
      cardhedgeCacheHit = cardhedgeCache.cacheHit
      cardhedgeResults = cardhedgeCache.results
      cardhedge_provider_query_key = cardhedgeCache.provider_query_key
      cardhedgePreknownHints = cardhedgeCache.preknownHints
    }
  }

  // Miss or expired -> fetch vendor

  if (!blendedCacheHit) {
    let providerCachePromise: Promise<void> | undefined
    if (!vendorCacheHit) {
      providerCachePromise = fetchFromPriceCharting(
        { apiBase: pcBase, apiKey: pcKey },
        id ?? undefined,
        q,
        limit
      ).then((results) => {
        raw = results.raw
        vendorResults = results.vendorResults
      })
    }
    let ebayFetchPromise: Promise<void> | undefined
    if (ebayEnabled && !ebayCacheHit && q) {
      ebayFetchPromise = fetchFromEbay(
        {
          base: ebayBase,
          appId: ebayAppId,
          certId: ebayCertId,
          marketplace: ebayMarketplace,
        },
        q,
        Number(limit)
      )
        .then((res) => {
          ebayResults = res.results
          ebayPreknownHints = res.preknownHints
        })
        .catch((err) => console.error('eBay fetch error', err))
    }
    let cardhedgeFetchPromise: Promise<void> | undefined
    if (cardhedgeEnabled && !cardhedgeCacheHit && q) {
      cardhedgeFetchPromise = fetchFromCardHedge(
        { apiBase: cardhedgeBase, apiKey: cardhedgeKey },
        q,
        Number(limit)
      )
        .then((res) => {
          cardhedgeResults = res.results
          cardhedgePreknownHints = res.preknownHints
        })
        .catch((err) => console.error('CardHedge fetch error', err))
    }
    const qNorm = normalize(q ?? '')
    let localRows: BlendedSearchResultItem[] = []
    const rpcBlendedPromise = fetch(`${supa}/rest/v1/rpc/search_cards_blended`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: srole,
        authorization: `Bearer ${srole}`,
      },
      body: JSON.stringify({
        p_q: qNorm,
        p_limit: Number(limit ?? '20'),
        // ITS-77: catalog filters (all optional; RPC guards each with IS NULL)
        p_genre: filters.genre ?? null,
        p_sets: filters.sets ?? null,
        p_min_price: filters.minPrice ?? null,
        p_max_price: filters.maxPrice ?? null,
        p_sealed: typeof filters.sealed === 'boolean' ? filters.sealed : null,
      }),
    })
      .then((rpc) => rpc.json() as Promise<Array<BlendedSearchResultItem>>)
      .then((json) => {
        localRows = json
      })

    await Promise.all([
      providerCachePromise,
      ebayFetchPromise,
      cardhedgeFetchPromise,
      rpcBlendedPromise,
    ])
    if (localRows.length && localRows[0].score >= SCORE_THRESHOLD) {
      blendedResults = (await Promise.all(localRows.map(mapLocalToResult))).map((v) => ({
        ...v,
        reason: {
          ...(v.reason ?? {}),
          vendor: 'local',
          vendor_priority: VENDOR_PRIORITY.local,
        },
      }))
    } else if (cardhedgeResults.length) {
      const n = cardhedgeResults.length
      blendedResults = cardhedgeResults.map((v, i) => ({
        ...v,
        snippet: v.snippet ?? `${v.card.set_name} • ${v.card.name}`,
        score: 0.25 + (n - i) * 0.01,
        source: 'vendor',
        reason: {
          ...(v.reason ?? {}),
          policy: 'cardhedge_fallback',
          vendor: 'cardhedge',
          vendor_priority: VENDOR_PRIORITY.cardhedge,
          vendor_rank: i + 1,
          formula: 'score = 0.25 + 0.01*(N - rank)',
        },
      }))
    } else if (vendorResults.length) {
      const n = vendorResults.length
      blendedResults = vendorResults.map((v, i) => ({
        ...v,
        snippet: v.snippet ?? `${v.card.set_name} • ${v.card.name}`,
        score: 0.2 + (n - i) * 0.01,
        source: 'vendor',
        reason: {
          ...(v.reason ?? {}),
          policy: 'vendor_fallback',
          vendor: 'pricecharting',
          vendor_priority: VENDOR_PRIORITY.pricecharting,
          vendor_rank: i + 1,
          formula: 'score = 0.2 + 0.01*(N - rank)',
        },
      }))
    } else if (ebayResults.length) {
      // Final fallback: use eBay listings when local DB + CardHedge + PriceCharting return nothing useful
      const n = ebayResults.length
      blendedResults = ebayResults.map((v, i) => ({
        ...v,
        score: 0.15 + (n - i) * 0.01,
        reason: {
          ...(v.reason ?? {}),
          policy: 'ebay_fallback',
          vendor: 'ebay',
          vendor_priority: VENDOR_PRIORITY.ebay,
          vendor_rank: i + 1,
          formula: 'score = 0.15 + 0.01*(N - rank)',
        },
      }))
    }
  }
  // Merge all preknown hints; CardHedge hints take precedence over eBay for same hash
  const mergedPreknownHints = new Map([...ebayPreknownHints, ...cardhedgePreknownHints])
  const withHints = await attachImageHints(blendedResults, supa, srole, mergedPreknownHints)

  withHints.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const finalResults = withHints.map((e, i) => ({ ...e, rank: i + 1 })) // rank added at the very end

  queryHash = await queryHashPromise
  const finalPayload = {
    query: q ?? (id ? `id:${id}` : ''),
    query_hash: queryHash,
    results: finalResults,
  }

  // Optional: ETag/304 (do this AFTER building finalPayload)
  const payloadStr = JSON.stringify(finalPayload)
  const etag = `"${await sha256HexStr(payloadStr)}"`

  if (inm && inm === etag) {
    return new Response(null, {
      status: 304,
      headers: corsHeaders(origin),
    })
  }

  handleCommitImages(finalResults, supa, srole, commitImages, cacheKey, queryNorm, queryHash)

  if (cacheUpsert) {
    if (!vendorCacheHit) {
      provider_query_key =
        provider_query_key ?? (await sha256HexStr(`${PRICECHARTING_PROVIDER}:${queryHash}`))
      upsertProviderCache(
        supa,
        srole,
        provider_query_key,
        raw,
        vendorResults,
        PRICECHARTING_CACHE_TTL
      )
    }
    if (ebayEnabled && !ebayCacheHit && ebayResults.length) {
      ebay_provider_query_key = ebay_provider_query_key ?? (await sha256HexStr(`ebay:${queryHash}`))
      upsertEbayProviderCache(supa, srole, ebay_provider_query_key, ebayResults, EBAY_CACHE_TTL)
    }
    if (cardhedgeEnabled && !cardhedgeCacheHit && cardhedgeResults.length) {
      cardhedge_provider_query_key =
        cardhedge_provider_query_key ?? (await sha256HexStr(`cardhedge:${queryHash}`))
      upsertCardHedgeProviderCache(
        supa,
        srole,
        cardhedge_provider_query_key,
        cardhedgeResults,
        CARDHEDGE_CACHE_TTL
      )
    }
    if (!blendedCacheHit) {
      upsertBlendedCache(supa, srole, queryHash, payloadStr, etag)
    }
  }

  return new Response(payloadStr, {
    headers: {
      'content-type': 'application/json',
      ...corsHeaders(origin),
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      etag: etag,
    },
  })
})

/** Fetch committed front images for a batch of real card UUIDs (local results only). */
async function fetchBoundImages(
  cardIds: string[],
  supa: string,
  srole: string
): Promise<Record<string, string>> {
  if (!cardIds.length) return {}
  const idsParam = cardIds.map((id) => `"${id}"`).join(',')
  const r = await fetch(
    `${supa}/rest/v1/card_images?card_id=in.(${idsParam})&kind=eq.front&status=eq.READY` +
      `&select=card_id,image_cache(storage_path)&limit=100`,
    { headers: { apikey: srole, authorization: `Bearer ${srole}` } }
  )
  const rows = (await r.json()) as Array<{
    card_id: string
    image_cache: { storage_path: string } | null
  }>
  const map: Record<string, string> = {}
  for (const row of rows) {
    const sp = row.image_cache?.storage_path
    if (sp) {
      // Build direct Supabase image-transform URL (no proxy hop needed)
      const w = 320
      const h = Math.round(w * (88 / 63)) // trading-card AR
      map[row.card_id] =
        `${supa}/storage/v1/render/image/public/images/${sp}` +
        `?width=${w}&height=${h}&resize=cover&quality=80`
    }
  }
  return map
}

/** Batch-fetch image_search_cache rows for a set of query hashes. */
async function fetchImageSearchCacheBatch(
  hashes: string[],
  supa: string,
  srole: string
): Promise<Record<string, string>> {
  if (!hashes.length) return {}
  const hashesParam = hashes.map((h) => `"${h}"`).join(',')
  const r = await fetch(
    `${supa}/rest/v1/image_search_cache?query_hash=in.(${hashesParam})` +
      `&select=query_hash,top_url,updated_at,ttl_seconds&limit=200`,
    { headers: { apikey: srole, authorization: `Bearer ${srole}` } }
  )
  const rows = (await r.json()) as Array<{
    query_hash: string
    top_url: string | null
    updated_at: string
    ttl_seconds: number
  }>
  const map: Record<string, string> = {}
  for (const row of rows) {
    const fresh = Date.now() - new Date(row.updated_at).getTime() < row.ttl_seconds * 1000
    if (fresh && row.top_url) map[row.query_hash] = row.top_url
  }
  return map
}

async function attachImageHints(
  entries: SearchResultItem[],
  supa: string,
  srole: string,
  preknownHints: Map<string, { url: string; norm: string }> = new Map()
): Promise<SearchResultItem[]> {
  // 1. Batch-check card_images for local results that already have committed front images
  const localIds = entries.filter((e) => e.source === 'local').map((e) => e.id)
  const boundMap = await fetchBoundImages(localIds, supa, srole)

  // 2. Compute query hash for every entry (all in parallel).
  //    eBay entries already carry a query_hash from normalization — reuse it directly
  //    instead of building a SerpAPI query.
  const withHashes = await Promise.all(
    entries.map(async (e) => {
      if (e.card.image?.query_hash) {
        // Pre-hashed by vendor normalizer (e.g. eBay) — no SerpAPI query needed
        return { e, q: null as string | null, qHash: e.card.image.query_hash }
      }
      const q = buildSerpQuery(
        {
          name: e.card.name,
          set: e.card.set_name,
          year: e.card.release_date ? parseInt(e.card.release_date) : undefined,
        },
        { includeNegatives: true, extraContext: ['front'] }
      )
      const qHash = await sha256HexStr(normalize(q))
      return { e, q, qHash }
    })
  )

  // 3. Batch-fetch image_search_cache for all hashes, then merge preknown hints
  const allHashes = withHashes.map((x) => x.qHash)
  const candidateMap = await fetchImageSearchCacheBatch(allHashes, supa, srole)
  for (const [hash, { url }] of preknownHints) {
    candidateMap[hash] = url // preknown wins
  }

  // 4a. Prewarm SerpAPI cache misses in the background (PC/local results only)
  for (const { e, q, qHash } of withHashes) {
    if (!q || boundMap[e.id] || candidateMap[qHash]) continue
    EdgeRuntime.waitUntil(
      fetch(`${supa}/functions/v1/image-search?q=${encodeURIComponent(q)}`, {
        headers: { authorization: `Bearer ${srole}`, apikey: srole },
      }).catch((err) => console.error('Image search prewarm error', err))
    )
  }

  // 4b. Persist new preknown hints into image_search_cache (fire-and-forget)
  if (preknownHints.size) {
    upsertImageSearchCacheHints(preknownHints, supa, srole)
  }

  // 5. Assemble results — prefer bound CDN URL, then direct preknown URL, then proxy
  return withHashes.map(({ e, qHash }) => {
    const boundUrl = e.source === 'local' ? boundMap[e.id] : undefined
    if (boundUrl) {
      return {
        ...e,
        card: { ...e.card, image: { kind: 'bound', url: boundUrl } },
      }
    }
    const directUrl = candidateMap[qHash] // set for CardHedge/eBay preknown hints
    const url =
      directUrl ?? `${supa}/functions/v1/image-proxy?query_hash=${qHash}&variant=thumb&shape=card`
    return {
      ...e,
      card: { ...e.card, image: { kind: 'candidate', url, query_hash: qHash } },
    }
  }) as SearchResultItem[]
}

function handleCommitImages(
  entries: SearchResultItem[],
  supa: string,
  srole: string,
  commitImages: boolean,
  cacheKey: string,
  queryNorm: string,
  queryHash: string
) {
  const promises = Promise.resolve(commitImages || isHot(cacheKey, queryNorm, queryHash)).then(
    (shouldCommit) => {
      if (!shouldCommit) {
        return
      }

      const topCandidatesCards = entries
        .map((r) => r.card)
        .filter((c) => Boolean(c.image?.query_hash))
      const promises = Array.from(new Set(topCandidatesCards)).map((c) => {
        // let a worker function translate query_hash -> top_url -> commit
        fetch(`${supa}/functions/v1/image-commit-from-query`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: srole,
            authorization: `Bearer ${srole}`,
          },
          body: JSON.stringify({
            query_hash: c.image!.query_hash,
            card_id: c.id,
            type: c.image!.kind,
            sample: 4,
          }), // sample=1: commit top-1
        }).catch((e) => {
          console.error('Image commit from query error', e)
        })
      })

      return Promise.all(promises)
    }
  )

  EdgeRuntime.waitUntil(promises)
}

async function isHot(qRaw: string, queryNorm: string, queryHash: string) {
  const bump = await supabase.rpc('bump_search_query', {
    p_query_raw: qRaw,
    p_query_norm: queryNorm,
    p_query_hash: queryHash,
    p_source: 'app',
  })

  if (bump.error) {
    throw bump.error
  }

  const [row] = (await bump.data) as Array<{
    hits: number
    last_seen: string
    committed_at: string | null
  }>

  return (
    row.hits >= HOT_THRESHOLD &&
    (!row.committed_at || Date.now() - new Date(row.committed_at).getTime() > COOL_OFF_MS)
  )
}

const fetchBlendedCache = async (supa: string, srole: string, queryHash: string) => {
  let cacheHit = false
  let vendorResults: SearchResultItem[] = []
  const cacheUrl = `${supa}/rest/v1/search_cache?query_hash=eq.${queryHash}&select=payload,updated_at,ttl_seconds`
  const check = await fetch(cacheUrl, {
    headers: { apikey: srole, authorization: `Bearer ${srole}` },
  })
  const rows = (await check?.json()) as
    Array<{ payload: string; updated_at: string; ttl_seconds: number }> | undefined
  const row = rows?.[0]
  const fresh = row && new Date(row.updated_at).getTime() + row.ttl_seconds * 1000 > Date.now()

  if (row && fresh) {
    cacheHit = true
    const parsed = (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) as
      { results?: SearchResultItem[] } | SearchResultItem[]
    vendorResults = Array.isArray(parsed) ? parsed : (parsed.results ?? [])
  }

  return { cacheHit, vendorResults }
}

const upsertBlendedCache = (
  supa: string,
  srole: string,
  queryHash: string,
  payloadStr: string,
  etag: string
) => {
  EdgeRuntime.waitUntil(
    fetch(`${supa}/rest/v1/search_cache`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: srole,
        authorization: `Bearer ${srole}`,
      },
      body: JSON.stringify({
        query_hash: queryHash,
        payload: payloadStr,
        etag: etag,
        expires_at: new Date(Date.now() + PRICECHARTING_CACHE_TTL * 1000).toISOString(),
      }),
    })
  )
}

/** Persist preknown eBay image hints into image_search_cache (fire-and-forget). */
function upsertImageSearchCacheHints(
  hints: Map<string, { url: string; norm: string }>,
  supa: string,
  srole: string
) {
  const rows = [...hints.entries()].map(([query_hash, { url: top_url, norm: query_norm }]) => ({
    query_hash,
    query_norm,
    candidates: [{ id: query_hash, sourceUrl: top_url }],
    top_url,
    ttl_seconds: 7 * 24 * 3600,
    updated_at: new Date().toISOString(),
  }))
  EdgeRuntime.waitUntil(
    fetch(`${supa}/rest/v1/image_search_cache`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: srole,
        authorization: `Bearer ${srole}`,
        prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    }).catch((err) => console.error('image_search_cache hint upsert error', err))
  )
}
