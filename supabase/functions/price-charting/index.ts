import { BlendedSearchResultItem, Card, PriceChartingEntry, SearchResultItem } from '@types'
import {
  buildSerpQuery,
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

const provider = 'pricecharting'

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
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS received, sending cors headers')
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': cors.origin,
        'Access-Control-Allow-Methods': cors.methods,
        'Access-Control-Allow-Headers': cors.headers,
      },
    })
  }
  const inm = req.headers.get('if-none-match') ?? ''
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const q = url.searchParams.get('q')
  const limit = url.searchParams.get('limit') ?? '20'
  const skipCache = url.searchParams.get('skipCache') === 'true'
  const cacheUpsert = (url.searchParams.get('skipCacheUpsert') ?? 'false') === 'false'

  const commitImages = Boolean(url.searchParams.get('commit_images'))

  const pcBase = Deno.env.get('PRICECHARTING_API_BASE')!
  const pcKey = Deno.env.get('PRICECHARTING_API_KEY')!
  const SCORE_THRESHOLD = Number(Deno.env.get('SCORE_THRESHOLD') ?? '0.35')
  const { supa, srole } = fetchGlobalVars()

  if (!pcBase || !pcKey || !supa || !srole) {
    return json({ error: 'Missing environment variables' }, { status: 500 })
  }

  const cacheKey = id ? `id:${id}` : q ? `q:${q!.toLowerCase().trim()}` : null

  const queryNorm = q ? normalize(q) : id ? `id:${id}` : ''
  const queryHashPromise = sha256HexStr(queryNorm || cacheKey!)
  let queryHash
  if (!cacheKey) return json({ error: 'Missing id or q' }, { status: 400 })

  // Check cache
  let vendorResults: SearchResultItem[] = []
  let blendedResults: SearchResultItem[] = []
  let vendorCacheHit = false
  let blendedCacheHit = false
  let raw
  let provider_query_key
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

    await Promise.all([providerCachePromise, rpcBlendedPromise])
    if (localRows.length && localRows[0].score >= SCORE_THRESHOLD) {
      blendedResults = await Promise.all(localRows.map(mapLocalToResult))
    } else {
      const n = vendorResults.length

      blendedResults = vendorResults.map((v, i) => ({
        ...v,
        // keep existing snippet if you set it earlier; otherwise build one
        snippet: v.snippet ?? `${v.card.set_name} • ${v.card.name}`,
        score: 0.2 + (n - i) * 0.01,
        source: 'vendor',
        reason: {
          ...(v.reason ?? {}),
          policy: 'vendor_fallback',
          vendor_rank: i + 1,
          formula: 'score = 0.2 + 0.01*(N - rank)', // helpful breadcrumb
        },
      }))
    }
  }
  const withHints = await attachImageHints(blendedResults, supa, srole)

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

async function getCandidateTopUrlOrPrewarm(card: Card, supa: string, srole: string) {
  const { name, set_name, release_date } = card
  const q = buildSerpQuery(
    {
      name: name,
      set: set_name,
      year: release_date ? parseInt(release_date) : undefined,
    },
    { includeNegatives: true, extraContext: ['front'] }
  )
  const qNorm = normalize(q)
  const qHash = await sha256HexStr(qNorm)

  const r = await fetch(
    `${supa}/rest/v1/image_search_cache?select=top_url,updated_at,ttl_seconds&query_hash=eq.${qHash}`,
    { headers: { apikey: srole, authorization: `Bearer ${srole}` } }
  )
  const [row] = await r.json()
  if (row?.top_url) {
    return { url: row.top_url as string, qHash }
  }

  // Prewarm in background; don't await
  EdgeRuntime.waitUntil(
    fetch(`${supa}/functions/v1/image-search?q=${encodeURIComponent(q)}`, {
      headers: { authorization: `Bearer ${srole}`, apikey: srole },
    }).catch((e) => {
      console.error('Image search error', e)
    })
  )
  return { url: null, qHash }
}

async function attachImageHints(
  entries: SearchResultItem[],
  supa: string,
  srole: string
): Promise<SearchResultItem[]> {
  const augmented = await Promise.all(
    entries.map(async (e) => {
      // If/when you can resolve bound images via card_images→image_cache, prefer those here.
      // For now, return candidate top_url (or null) and prewarm if needed.
      const { url, qHash } = await getCandidateTopUrlOrPrewarm(e.card, supa, srole)
      const proxy = `${supa}/functions/v1/image-proxy?query_hash=${qHash}&variant=thumb&shape=card`

      return {
        ...e,
        card: {
          ...e.card,
          image: {
            ...e.card.image,
            kind: 'candidate',
            url: proxy,
            query_hash: qHash,
          },
        },
      }
    })
  )
  return augmented as SearchResultItem[]
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
    vendorResults = JSON.parse(row.payload) as SearchResultItem[] // <-- IMPORTANT: unwrap the data payload
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
    console.debug({ vendorUrl, vres })
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
