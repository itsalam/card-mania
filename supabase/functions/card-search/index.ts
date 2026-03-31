import { BlendedSearchResultItem, Card, SearchResultItem } from '@types'
import {
  buildSerpQuery,
  createSupabaseServiceClient,
  fetchGlobalVars,
  normalize,
  sha256HexStr,
} from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  EbaySearchFilters,
  getEbayAppToken,
  getUserEbaySellerUsername,
  searchEbayListings,
} from '../_shared/providers/ebay.ts'
import {
  PriceChartingFilters,
  searchPriceChartingListings,
} from '../_shared/providers/pricecharting.ts'

const supabase = createSupabaseServiceClient()

const provider = 'pricecharting'

const HOT_THRESHOLD = Number(Deno.env.get('IMAGE_HOT_THRESHOLD') ?? '20')
const COOL_OFF_MS = Number(Deno.env.get('IMAGE_COOL_OFF_MS') ?? `${24 * 60 * 60 * 1000}`)
const PRICECHARTING_CACHE_TTL = Number(Deno.env.get('PRICECHARTING_CACHE_TTL') ?? '300')

const json = (v: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(v), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })

const cors = {
  origin: '*',
  headers: 'authorization,content-type',
  methods: 'GET,OPTIONS',
}

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type Filters = PriceChartingFilters

// Local result carries grades_prices from the DB (passed in after batch fetch).
const mapLocalToResult = async (
  r: BlendedSearchResultItem,
  gradesPrices: Record<string, number>
): Promise<SearchResultItem> => ({
  id: r.id,
  card: {
    id: r.id, // local card UUID — use directly, no vendor wrapping needed
    name: r.name,
    set_name: r.set_name,
    latest_price: r.latest_price ?? null,
    grades_prices: gradesPrices,
  },
  score: r.score,
  snippet: r.snippet,
  reason: { ...r.reason, policy: 'local' },
  source: 'local',
})

// ---------------------------------------------------------------------------
// Serve
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': cors.origin,
        'Access-Control-Allow-Methods': cors.methods,
        'Access-Control-Allow-Headers': cors.headers,
      },
    })
  }

  const inm = req.headers.get('if-none-match') ?? ''
  const authHeader = req.headers.get('Authorization')
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const q = url.searchParams.get('q')
  const limit = url.searchParams.get('limit') ?? '20'
  const skipCache = url.searchParams.get('skipCache') === 'true'
  const cacheUpsert = (url.searchParams.get('skipCacheUpsert') ?? 'false') === 'false'
  const commitImages = Boolean(url.searchParams.get('commit_images'))
  // Opaque cursor — treated as a numeric offset for paginating vendor results
  const cursor = url.searchParams.get('cursor')
  const offset = cursor ? parseInt(cursor, 10) : 0

  // Filters forwarded to providers
  const filters: Filters = {
    sport: url.searchParams.get('filters[sport]') ?? url.searchParams.get('sport') ?? undefined,
    minPrice: parseOptionalFloat(
      url.searchParams.get('filters[minPrice]') ?? url.searchParams.get('minPrice')
    ),
    maxPrice: parseOptionalFloat(
      url.searchParams.get('filters[maxPrice]') ?? url.searchParams.get('maxPrice')
    ),
    offset,
  }

  const pcBase = Deno.env.get('PRICECHARTING_API_BASE')!
  const pcKey = Deno.env.get('PRICECHARTING_API_KEY')!
  const SCORE_THRESHOLD = Number(Deno.env.get('SCORE_THRESHOLD') ?? '0.35')
  const { supa, srole } = fetchGlobalVars()

  if (!pcBase || !pcKey || !supa || !srole) {
    return json({ error: 'Missing environment variables' }, { status: 500 })
  }

  const cacheKey = id ? `id:${id}` : q ? `q:${q!.toLowerCase().trim()}` : null
  if (!cacheKey) return json({ error: 'Missing id or q' }, { status: 400 })

  const queryNorm = q ? normalize(q) : id ? `id:${id}` : ''
  const queryHashPromise = sha256HexStr(queryNorm || cacheKey)

  // eBay integration (optional — only active when credentials are configured)
  const ebayAppId = Deno.env.get('EBAY_APP_ID')
  const ebayCertId = Deno.env.get('EBAY_CERT_ID')
  const ebayMarketplace = Deno.env.get('EBAY_MARKETPLACE') ?? 'EBAY_US'
  const ebayEnabled = Boolean(ebayAppId && ebayCertId)

  // ---------------------------------------------------------------------------
  // Cache checks
  // ---------------------------------------------------------------------------

  let vendorResults: SearchResultItem[] = []
  let blendedResults: SearchResultItem[] = []
  let vendorCacheHit = false
  let blendedCacheHit = false
  let raw: any
  let provider_query_key: string | undefined

  let queryHash: string

  if (!skipCache) {
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
  }

  // ---------------------------------------------------------------------------
  // Cache miss — fetch from providers + local DB in parallel
  // ---------------------------------------------------------------------------

  if (!blendedCacheHit) {
    const qNorm = normalize(q ?? '')

    // Build all I/O tasks
    const pcFetchPromise: Promise<void> = vendorCacheHit
      ? Promise.resolve()
      : searchPriceChartingListings(pcBase, pcKey, id ?? undefined, q, limit, filters).then(
          (res) => {
            raw = res.raw
            vendorResults = res.vendorResults
          }
        )

    let localRows: BlendedSearchResultItem[] = []
    const localFetchPromise = fetch(`${supa}/rest/v1/rpc/search_cards_blended`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: srole,
        authorization: `Bearer ${srole}`,
      },
      body: JSON.stringify({ p_q: qNorm, p_limit: Number(limit ?? '20') }),
    })
      .then((rpc) => rpc.json() as Promise<Array<BlendedSearchResultItem>>)
      .then((rows) => {
        localRows = rows
      })

    // eBay: token + optional user seller lookup, then search
    let ebayGeneral: SearchResultItem[] = []
    let ebaySeller: SearchResultItem[] = []
    let ebaySellerUsername: string | null = null

    const ebayPromise: Promise<void> = !ebayEnabled
      ? Promise.resolve()
      : runEbaySearches(
          q ?? '',
          filters,
          parseInt(limit),
          authHeader,
          supa,
          srole,
          ebayAppId!,
          ebayCertId!,
          ebayMarketplace
        )
          .then((res) => {
            ebayGeneral = res.general
            ebaySeller = res.seller
            ebaySellerUsername = res.sellerUsername
          })
          .catch((e) => {
            console.error('eBay search failed (non-fatal):', e)
          })

    await Promise.all([pcFetchPromise, localFetchPromise, ebayPromise])

    // -----------------------------------------------------------------------
    // Blend results: local → seller listings → general vendor
    // -----------------------------------------------------------------------

    const highScoreLocal = localRows.filter((r) => r.score >= SCORE_THRESHOLD)

    // Batch-fetch grades_prices for local results (single DB round-trip)
    const gradesPricesMap =
      highScoreLocal.length > 0
        ? await batchFetchGradesPrices(
            highScoreLocal.map((r) => r.id),
            supa,
            srole
          )
        : new Map<string, Record<string, number>>()

    const localMapped = await Promise.all(
      highScoreLocal.map((r) => mapLocalToResult(r, gradesPricesMap.get(r.id) ?? {}))
    )

    // eBay seller listings get a strong but sub-local score boost
    const sellerScored = ebaySeller.map((v, i) => ({
      ...v,
      score: 0.7 - i * 0.01,
      reason: {
        ...(v.reason ?? {}),
        policy: 'ebay_seller',
        seller_username: ebaySellerUsername,
        vendor_rank: i + 1,
      },
    }))

    // General vendor results fill the remainder — deduplicate across sources
    const seenIds = new Set([...localMapped.map((r) => r.id), ...sellerScored.map((r) => r.id)])
    const allGeneralVendor = [...vendorResults, ...ebayGeneral].filter((v) => !seenIds.has(v.id))
    const n = allGeneralVendor.length
    const generalScored = allGeneralVendor.map((v, i) => ({
      ...v,
      snippet: v.snippet ?? `${v.card.set_name} • ${v.card.name}`,
      score: 0.2 + (n - i) * 0.01,
      reason: {
        ...(v.reason ?? {}),
        policy: 'vendor_fallback',
        vendor_rank: i + 1,
        formula: 'score = 0.2 + 0.01*(N - rank)',
      },
    }))

    blendedResults = [...localMapped, ...sellerScored, ...generalScored].slice(0, parseInt(limit))
  }

  // ---------------------------------------------------------------------------
  // Attach image hints (batched — 1 DB round-trip instead of N)
  // ---------------------------------------------------------------------------

  const withHints = await attachImageHints(blendedResults, supa, srole)

  withHints.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const finalResults = withHints.map((e, i) => ({ ...e, rank: i + 1 }))

  queryHash = await queryHashPromise
  const finalPayload = {
    query: q ?? (id ? `id:${id}` : ''),
    query_hash: queryHash,
    results: finalResults,
  }

  const payloadStr = JSON.stringify(finalPayload)
  const etag = `"${await sha256HexStr(payloadStr)}"`

  if (inm && inm === etag) {
    return new Response(null, {
      status: 304,
      headers: { 'Access-Control-Allow-Origin': cors.origin },
    })
  }

  handleCommitImages(finalResults, supa, srole, commitImages, cacheKey, queryNorm, queryHash)

  if (cacheUpsert) {
    if (!vendorCacheHit) {
      provider_query_key = provider_query_key ?? (await sha256HexStr(`${provider}:${queryHash}`))
      upsertProviderCache(supa, srole, provider_query_key, raw, vendorResults)
    }
    if (!blendedCacheHit) {
      upsertBlendedCache(supa, srole, queryHash, payloadStr, etag)
    }
  }

  return new Response(payloadStr, {
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': cors.origin,
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      etag: etag,
    },
  })
})

// ---------------------------------------------------------------------------
// eBay orchestration
// ---------------------------------------------------------------------------

async function runEbaySearches(
  q: string,
  filters: Filters,
  limit: number,
  authHeader: string | null,
  supa: string,
  srole: string,
  appId: string,
  certId: string,
  marketplace: string
): Promise<{
  general: SearchResultItem[]
  seller: SearchResultItem[]
  sellerUsername: string | null
}> {
  const userId = parseUserIdFromBearer(authHeader)

  const [appToken, sellerUsername] = await Promise.all([
    getEbayAppToken(appId, certId),
    userId ? getUserEbaySellerUsername(userId, supa, srole) : Promise.resolve(null),
  ])

  const ebayFilters: EbaySearchFilters = {
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    limit,
    offset: filters.offset,
  }

  const [general, seller] = await Promise.all([
    searchEbayListings(q, ebayFilters, appToken, marketplace),
    sellerUsername
      ? searchEbayListings(q, { ...ebayFilters, sellerUsername }, appToken, marketplace)
      : Promise.resolve([]),
  ])

  return { general, seller, sellerUsername }
}

/** Extract the Supabase user ID (`sub` claim) from a Bearer JWT without verifying. */
function parseUserIdFromBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const payload = JSON.parse(atob(authHeader.slice(7).split('.')[1]))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Batch grades_prices fetch
// ---------------------------------------------------------------------------

async function batchFetchGradesPrices(
  cardIds: string[],
  supa: string,
  srole: string
): Promise<Map<string, Record<string, number>>> {
  if (!cardIds.length) return new Map()

  const res = await fetch(
    `${supa}/rest/v1/cards?id=in.(${cardIds.map(encodeURIComponent).join(',')})&select=id,grades_prices`,
    { headers: { apikey: srole, authorization: `Bearer ${srole}` } }
  )
  if (!res.ok) return new Map()

  const rows = (await res.json()) as Array<{
    id: string
    grades_prices: Record<string, number> | null
  }>
  return new Map(rows.map((r) => [r.id, r.grades_prices ?? {}]))
}

// ---------------------------------------------------------------------------
// Image hints — batched (1 DB fetch instead of N)
// ---------------------------------------------------------------------------

async function attachImageHints(
  entries: SearchResultItem[],
  supa: string,
  srole: string
): Promise<SearchResultItem[]> {
  if (!entries.length) return entries

  // Build SERP query + hash for each entry
  const queryInfos = await Promise.all(
    entries.map(async (e) => {
      const { name, set_name, release_date } = e.card
      const serpQ = buildSerpQuery(
        { name, set: set_name, year: release_date ? parseInt(release_date) : undefined },
        { includeNegatives: true, extraContext: ['front'] }
      )
      const qHash = await sha256HexStr(normalize(serpQ))
      return { entry: e, serpQ, qHash }
    })
  )

  // Single batch DB fetch for all hashes
  const uniqueHashes = [...new Set(queryInfos.map((qi) => qi.qHash))]
  const cacheRes = await fetch(
    `${supa}/rest/v1/image_search_cache?select=query_hash,top_url&query_hash=in.(${uniqueHashes.join(',')})`,
    { headers: { apikey: srole, authorization: `Bearer ${srole}` } }
  )
  const cacheRows: Array<{ query_hash: string; top_url: string | null }> = cacheRes.ok
    ? await cacheRes.json()
    : []
  const cacheMap = new Map(cacheRows.map((r) => [r.query_hash, r.top_url]))

  // Prewarm any cache misses (fire-and-forget)
  for (const { serpQ, qHash } of queryInfos) {
    if (!cacheMap.has(qHash)) {
      EdgeRuntime.waitUntil(
        fetch(`${supa}/functions/v1/image-search?q=${encodeURIComponent(serpQ)}`, {
          headers: { authorization: `Bearer ${srole}`, apikey: srole },
        }).catch((e) => console.error('Image search prewarm error', e))
      )
    }
  }

  // Attach proxy URL + query_hash to every entry
  return queryInfos.map(({ entry, qHash }) => ({
    ...entry,
    card: {
      ...entry.card,
      image: {
        ...entry.card.image,
        kind: 'candidate' as const,
        url: `${supa}/functions/v1/image-proxy?query_hash=${qHash}&variant=thumb&shape=card`,
        query_hash: qHash,
      },
    },
  })) as SearchResultItem[]
}

// ---------------------------------------------------------------------------
// Cache read/write helpers
// ---------------------------------------------------------------------------

const fetchBlendedCache = async (supa: string, srole: string, queryHash: string) => {
  let cacheHit = false
  let vendorResults: SearchResultItem[] = []
  const check = await fetch(
    `${supa}/rest/v1/search_cache?query_hash=eq.${queryHash}&select=payload,updated_at,ttl_seconds`,
    { headers: { apikey: srole, authorization: `Bearer ${srole}` } }
  )
  const rows = (await check?.json()) as
    | Array<{ payload: string; updated_at: string; ttl_seconds: number }>
    | undefined
  const row = rows?.[0]
  const fresh = row && new Date(row.updated_at).getTime() + row.ttl_seconds * 1000 > Date.now()

  if (row && fresh) {
    cacheHit = true
    vendorResults = JSON.parse(row.payload) as SearchResultItem[]
  }

  return { cacheHit, vendorResults }
}

const fetchProviderCache = async (supa: string, srole: string, queryHash: string) => {
  let cacheHit = false
  let vendorResults: SearchResultItem[] = []
  const provider_query_key = await sha256HexStr(`${provider}:${queryHash}`)
  const check = await fetch(
    `${supa}/rest/v1/provider_search_cache?provider_query_key=eq.${encodeURIComponent(
      provider_query_key
    )}&select=normalized_items,expires_at`,
    { headers: { apikey: srole, authorization: `Bearer ${srole}` } }
  )
  const rows = (await check?.json()) as
    | Array<{ normalized_items: string; expires_at: string }>
    | undefined
  const row = rows?.[0]
  const fresh = row && new Date(row.expires_at).getTime() > Date.now()

  if (!check.ok) {
    console.log('Provider cache check error', check.status, check.statusText)
  } else if (row && fresh) {
    cacheHit = true
    vendorResults = JSON.parse(row.normalized_items) as SearchResultItem[]
  }

  return { cacheHit, vendorResults, provider_query_key }
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
        provider,
        provider_query_key,
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
        etag,
        expires_at: new Date(Date.now() + PRICECHARTING_CACHE_TTL * 1000).toISOString(),
      }),
    })
  )
}

// ---------------------------------------------------------------------------
// Hot query + image commit
// ---------------------------------------------------------------------------

async function getCandidateTopUrlOrPrewarm(card: Card, supa: string, srole: string) {
  const { name, set_name, release_date } = card
  const q = buildSerpQuery(
    { name, set: set_name, year: release_date ? parseInt(release_date) : undefined },
    { includeNegatives: true, extraContext: ['front'] }
  )
  const qHash = await sha256HexStr(normalize(q))

  const r = await fetch(
    `${supa}/rest/v1/image_search_cache?select=top_url,updated_at,ttl_seconds&query_hash=eq.${qHash}`,
    { headers: { apikey: srole, authorization: `Bearer ${srole}` } }
  )
  const [row] = await r.json()
  if (row?.top_url) return { url: row.top_url as string, qHash }

  EdgeRuntime.waitUntil(
    fetch(`${supa}/functions/v1/image-search?q=${encodeURIComponent(q)}`, {
      headers: { authorization: `Bearer ${srole}`, apikey: srole },
    }).catch((e) => console.error('Image search error', e))
  )
  return { url: null, qHash }
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
      if (!shouldCommit) return

      const topCandidatesCards = entries
        .map((r) => r.card)
        .filter((c) => Boolean(c.image?.query_hash))
      return Promise.all(
        Array.from(new Set(topCandidatesCards)).map((c) =>
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
            }),
          }).catch((e) => console.error('Image commit from query error', e))
        )
      )
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

  if (bump.error) throw bump.error

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

async function fetchInternalIds(
  provider: string,
  vendorIds: string[],
  supa: string,
  srole: string
) {
  const resolvedIds: Record<string, string | null> = {}

  if (vendorIds.length) {
    const resp = await fetch(`${supa}/rest/v1/rpc/resolve_external_refs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: srole,
        authorization: `Bearer ${srole}`,
      },
      body: JSON.stringify({ p_provider: provider, p_ids: vendorIds }),
    })
    const rows = (await resp.json()) as Array<{ external_id: string; card_id: string | null }>
    for (const r of rows) resolvedIds[r.external_id] = r.card_id
  }

  return resolvedIds
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function parseOptionalFloat(v: string | null | undefined): number | undefined {
  if (!v) return undefined
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}
