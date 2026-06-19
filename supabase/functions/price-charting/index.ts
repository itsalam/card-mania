import { fetchCardHedgeResults, fetchCardHedgeTopMovers } from '@cardhedge'
import { getEbayToken, searchEbayItems } from '@ebay-auth'
import {
  BlendedSearchResultItem,
  CardHedgeCard,
  EbayItemSummary,
  PriceChartingEntry,
  SearchResultItem,
} from '@types'
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

const provider = 'pricecharting'

const json = (v: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(v), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })

const convertPCEntrytoSearchItem = async (p: PriceChartingEntry): Promise<SearchResultItem> => ({
  id: p.id,
  card: {
    id: await vendorUUID(provider, p.id),
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

const mapLocalToResult = async (r: BlendedSearchResultItem): Promise<SearchResultItem> => ({
  id: r.id,
  card: {
    id: await vendorUUID(provider, r.id),
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

const convertToPriceEntry = (data: any): PriceChartingEntry => ({
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
  const queryHashPromise = sha256HexStr(queryNorm || cacheKey!)
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
      const providerCache = await fetchProviderCache(supa, srole, queryHash)

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
      providerCachePromise = fetchFromProvider(pcBase, pcKey, id ?? undefined, q, limit).then(
        (results) => {
          raw = results.raw
          vendorResults = results.vendorResults
        }
      )
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
      cardhedgeFetchPromise = fetchFromCardHedge(cardhedgeBase, cardhedgeKey, q, Number(limit))
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
      body: JSON.stringify({ p_q: qNorm, p_limit: Number(limit ?? '20') }),
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
      provider_query_key = provider_query_key ?? (await sha256HexStr(`${provider}:${queryHash}`))
      upsertProviderCache(supa, srole, provider_query_key, raw, vendorResults)
    }
    if (ebayEnabled && !ebayCacheHit && ebayResults.length) {
      ebay_provider_query_key = ebay_provider_query_key ?? (await sha256HexStr(`ebay:${queryHash}`))
      upsertEbayProviderCache(supa, srole, ebay_provider_query_key, ebayResults)
    }
    if (cardhedgeEnabled && !cardhedgeCacheHit && cardhedgeResults.length) {
      cardhedge_provider_query_key =
        cardhedge_provider_query_key ?? (await sha256HexStr(`cardhedge:${queryHash}`))
      upsertCardHedgeProviderCache(supa, srole, cardhedge_provider_query_key, cardhedgeResults)
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
    | Array<{ payload: string; updated_at: string; ttl_seconds: number }>
    | undefined
  const row = rows?.[0]
  const fresh = row && new Date(row.updated_at).getTime() + row.ttl_seconds * 1000 > Date.now()

  if (row && fresh) {
    cacheHit = true
    const parsed = (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) as
      | { results?: SearchResultItem[] }
      | SearchResultItem[]
    vendorResults = Array.isArray(parsed) ? parsed : (parsed.results ?? [])
  }

  return { cacheHit, vendorResults }
}

const fetchProviderCache = async (supa: string, srole: string, queryHash: string) => {
  let cacheHit = false
  let vendorResults: SearchResultItem[] = []
  const provider_query_key = await sha256HexStr(`${provider}:${queryHash}`)
  const cacheUrl = `${supa}/rest/v1/provider_search_cache?provider_query_key=eq.${encodeURIComponent(
    provider_query_key
  )}&select=normalized_items,expires_at`
  const check = await fetch(cacheUrl, {
    headers: { apikey: srole, authorization: `Bearer ${srole}` },
  })
  const rows = (await check?.json()) as
    | Array<{ normalized_items: string; expires_at: string }>
    | undefined

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

const fetchFromProvider = async (
  pcBase: string,
  pcKey: string,
  id: string | undefined,
  q: string | null,
  limit: string
) => {
  let vendorResults: SearchResultItem[] = []
  const pcBaseUrl = new URL(`${pcBase}/api/product${id ? '' : 's'}`)
  pcBaseUrl.searchParams.set('t', pcKey)
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

const upsertProviderCache = (
  supa: string,
  srole: string,
  provider_query_key: string,
  raw: string | undefined,
  vendorResults: SearchResultItem[]
) => {
  EdgeRuntime.waitUntil(
    fetch(`${supa}/rest/v1/provider_search_cache`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: srole,
        authorization: `Bearer ${srole}`,
      },
      body: JSON.stringify({
        provider: provider,
        provider_query_key: provider_query_key,
        raw_payload: raw,
        normalized_items: vendorResults,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + PRICECHARTING_CACHE_TTL * 1000).toISOString(),
      }),
    })
  )
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

// ─── eBay helpers ────────────────────────────────────────────────────────────

type EbayConfig = {
  base: string
  appId: string
  certId: string
  marketplace: string
}

/** Normalize eBay items into SearchResultItems + build a preknownHints map for image attachment. */
async function convertEbayItems(items: EbayItemSummary[]): Promise<{
  results: SearchResultItem[]
  preknownHints: Map<string, { url: string; norm: string }>
}> {
  const preknownHints = new Map<string, { url: string; norm: string }>()

  const results = await Promise.all(
    items.map(async (item) => {
      const cardId = await vendorUUID('ebay', item.itemId)
      const price = item.price ? parseFloat(item.price.value) : null

      let imageHint: SearchResultItem['card']['image']
      const imageUrl = item.image?.imageUrl
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
async function fetchFromEbay(
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
async function fetchEbayProviderCache(supa: string, srole: string, queryHash: string) {
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
    | Array<{ normalized_items: string; expires_at: string }>
    | undefined
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

/** Persist eBay results into provider_search_cache (fire-and-forget). */
function upsertEbayProviderCache(
  supa: string,
  srole: string,
  provider_query_key: string,
  results: SearchResultItem[]
) {
  EdgeRuntime.waitUntil(
    fetch(`${supa}/rest/v1/provider_search_cache`, {
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
        expires_at: new Date(Date.now() + EBAY_CACHE_TTL * 1000).toISOString(),
      }),
    }).catch((err) => console.error('eBay provider cache upsert error', err))
  )
}

// ─── CardHedge helpers ───────────────────────────────────────────────────────

/** Normalize CardHedge cards into SearchResultItems + build a preknownHints map. */
async function convertCardHedgeItems(cards: CardHedgeCard[]): Promise<{
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
          const raw_key = grade.toLowerCase().replace(/\s+/g, '_')
          const key = raw_key === 'raw' ? 'ungraded' : raw_key
          const val = parseFloat(price) * 100
          if (!isNaN(val)) grades_prices[key] = val
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
async function fetchFromCardHedge(
  apiBase: string,
  apiKey: string,
  q: string,
  limit: number
): Promise<{
  results: SearchResultItem[]
  preknownHints: Map<string, { url: string; norm: string }>
}> {
  const cards = await fetchCardHedgeResults(q, apiKey, apiBase, limit)
  const sportsCards = cards.filter((c) => c.category_group === 'Sports Cards')
  return convertCardHedgeItems(sportsCards)
}

/** Check provider_search_cache for a cached CardHedge response. */
async function fetchCardHedgeProviderCache(supa: string, srole: string, queryHash: string) {
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
    | Array<{ normalized_items: string; expires_at: string }>
    | undefined
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

/** Persist CardHedge results into provider_search_cache (fire-and-forget). */
function upsertCardHedgeProviderCache(
  supa: string,
  srole: string,
  provider_query_key: string,
  results: SearchResultItem[]
) {
  EdgeRuntime.waitUntil(
    fetch(`${supa}/rest/v1/provider_search_cache`, {
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
        expires_at: new Date(Date.now() + CARDHEDGE_CACHE_TTL * 1000).toISOString(),
      }),
    }).catch((err) => console.error('CardHedge provider cache upsert error', err))
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
