import { ImageItem, SerpImageResults } from '@types'
import {
  buildSerpQuery,
  CardKeyFields,
  corsHeaders,
  createSupabaseClient,
  createSupabaseServiceClient,
  json,
  normalize,
  ok,
  sha256HexStr,
} from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const DEFAULT_LIMIT = 12
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // set via `supabase secrets set`
const supabase = createSupabaseServiceClient()

export function decodeCardKey(key: string): CardKeyFields & { v: number } {
  const raw = key.startsWith('ck:') ? key.slice(3) : key
  const decoded = decodeURIComponent(raw)
  const trimmed = decoded.trim()
  const trimmedNoQuotes = trimmed.replace(/^['"`]|['"`]$/g, '')
  const obj = JSON.parse(trimmedNoQuotes)
  if (
    typeof obj?.set !== 'string' ||
    typeof obj?.name !== 'string' ||
    typeof obj?.year !== 'number'
  ) {
    throw new Error('Invalid card key')
  }
  return obj
}

type AuthCtx =
  | { kind: 'service' }
  | { kind: 'user'; user: import('@supabase/supabase-js').User }
  | { kind: 'none' }

async function getAuthContext(req: Request): Promise<AuthCtx> {
  const bearer = req.headers.get('authorization') ?? ''
  const token = bearer.includes('Bearer ') ? bearer.slice(7) : ''

  if (!token) return { kind: 'none' }
  if (token === SERVICE_ROLE) return { kind: 'service' } // server→server

  const sb = createSupabaseClient(req)

  const { data, error } = await sb.auth.getUser()
  if (error || !data.user) return { kind: 'none' }
  return { kind: 'user', user: data.user }
}

Deno.serve(async (req) => {
  const auth = await getAuthContext(req)

  // allow internal service calls
  if (auth.kind !== 'service') {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin') ?? ''
    const headers = corsHeaders(origin)
    return new Response(null, { status: Object.keys(headers).length ? 204 : 403, headers })
  }
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')
    const key = searchParams.get('key')
    const limit = Number(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`)

    const serpBase = Deno.env.get('SERP_API_BASE')!
    const serpKey = Deno.env.get('SERP_API_KEY')!

    if (!serpKey) {
      console.error('Server misconfigured', { serpKey })
      return json({ error: 'Server misconfigured' }, { status: 500 })
    }

    if (!q && !key) {
      console.error('Missing q or key')
      return json({ error: 'Missing q or key' }, { status: 400 })
    }
    if (q && key) {
      console.error('Must use q or key')
      return json({ error: 'Must use q or key' }, { status: 400 })
    }
    let query = q
    if (key) {
      const cardKey = decodeCardKey(key)
      query = buildSerpQuery(cardKey)
    }

    const qNorm = normalize(query!)
    const qHash = await sha256HexStr(qNorm)
    const { data: cached } = await supabase
      .from('image_search_cache')
      .select('candidates, ttl_seconds, updated_at')
      .eq('query_hash', qHash)
      .maybeSingle()
    if (cached) {
      const fresh = Date.now() - new Date(cached.updated_at).getTime() < cached.ttl_seconds * 1000
      if (fresh) {
        return ok(
          json({
            query: qNorm,
            candidates: String(cached.candidates).slice(0, limit),
          })
        )
      }
    }

    const vendorUrl = `${serpBase}/search.json?engine=google_images&q=${encodeURIComponent(
      query!
    )}&api_key=${serpKey}`
    const result = await fetch(vendorUrl, {
      headers: { accept: 'application/json' },
    })
    if (!result.ok) {
      return Response.json(
        { error: `Vendor ${result.status}` },
        {
          status: 502,
        }
      )
    }

    const raw = await result.json()

    const baseItems = (raw.images_results ?? raw.results ?? []) as SerpImageResults[]
    // Normalize
    const items: ImageItem[] = baseItems.map((r) => ({
      id: crypto.randomUUID(),
      sourceUrl: r.original ?? r.thumbnail ?? r.link ?? r.serpapi_related_content_link,
      width: r.original_width,
      height: r.original_height,
    }))

    const candidates = await filterViable(items, {
      max: limit,
      maxBytes: 512 * 1024,
    })

    // write-through query cache
    await supabase.from('image_search_cache').upsert({
      query_hash: qHash,
      query_norm: qNorm,
      candidates,
      top_url: candidates[0]?.sourceUrl ?? null,
      ttl_seconds: 7 * 24 * 3600,
      updated_at: new Date().toISOString(),
    })

    return ok(json({ query: qNorm, candidates }))
  } catch (e) {
    console.error('Image search error', e)
    return json({ error: String((e as Error).message || e) }, { status: 500 })
  }
})

async function filterViable(items: ImageItem[], opts: { max: number; maxBytes: number }) {
  type ViableItem = ImageItem & { contentType?: string; bytes?: number }

  async function checkItem(item: ImageItem): Promise<ViableItem | null> {
    if (!item.sourceUrl) return null
    try {
      // Try HEAD first — no body download, much faster
      const head = await fetch(item.sourceUrl, { method: 'HEAD', headers: { accept: 'image/*' } })
      if (head.ok) {
        const ct = head.headers.get('content-type') ?? undefined
        if (ct && !ct.startsWith('image/')) return null
        const cl = head.headers.get('content-length')
        const bytes = cl ? parseInt(cl) : undefined
        if (bytes !== undefined && bytes > opts.maxBytes) return null
        return { ...item, contentType: ct, bytes }
      }
      // HEAD failed (e.g. 405 Method Not Allowed) — fall back to GET
      const res = await fetch(item.sourceUrl, { method: 'GET', headers: { accept: 'image/*' } })
      if (!res.ok) return null
      const ct = res.headers.get('content-type') ?? undefined
      const buf = new Uint8Array(await res.arrayBuffer())
      if (buf.byteLength > opts.maxBytes) return null
      return { ...item, contentType: ct, bytes: buf.byteLength }
    } catch {
      return null
    }
  }

  // Run all checks in parallel
  const results = await Promise.allSettled(items.map(checkItem))
  const out: ViableItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      out.push(r.value)
      if (out.length >= opts.max) break
    }
  }
  if (out.length === 0) throw new Error('No viable image found')
  return out
}
