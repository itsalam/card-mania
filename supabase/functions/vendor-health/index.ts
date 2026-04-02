/**
 * vendor-health — smoke-test edge function.
 *
 * GET /functions/v1/vendor-health
 *
 * Probes each configured vendor API and returns a health report.
 * Returns HTTP 200 when all enabled vendors are reachable, 503 otherwise.
 *
 * Response shape:
 * {
 *   ok: boolean,
 *   checkedAt: string,         // ISO timestamp
 *   vendors: {
 *     [name]: {
 *       status: "ok" | "fail" | "disabled",
 *       latencyMs?: number,
 *       detail: string
 *     }
 *   }
 * }
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const TIMEOUT_MS = 8_000
const TEST_QUERY = 'charizard base set'

type VendorStatus = {
  status: 'ok' | 'fail' | 'disabled'
  latencyMs?: number
  detail: string
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function env(key: string): string {
  return Deno.env.get(key) ?? ''
}

async function timedFetch(
  req: Request | string,
  init?: RequestInit
): Promise<{
  ok: boolean
  status: number
  latencyMs: number
  body: string
}> {
  const start = Date.now()
  const resp = await Promise.race([
    fetch(req, init),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`request timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    ),
  ])
  const latencyMs = Date.now() - start
  const body = await resp.text().catch(() => '')
  return { ok: resp.ok, status: resp.status, latencyMs, body }
}

// ─── vendor probes ───────────────────────────────────────────────────────────

async function probePriceCharting(): Promise<VendorStatus> {
  const base = env('PRICECHARTING_API_BASE')
  const key = env('PRICECHARTING_API_KEY')
  if (!base || !key) {
    return {
      status: 'disabled',
      detail: 'PRICECHARTING_API_BASE or PRICECHARTING_API_KEY not set',
    }
  }
  try {
    const url = new URL(`${base}/api/products`)
    url.searchParams.set('q', TEST_QUERY)
    url.searchParams.set('t', key)
    const { ok, status, latencyMs, body } = await timedFetch(url.toString(), {
      headers: { accept: 'application/json' },
    })
    if (!ok) {
      return {
        status: 'fail',
        latencyMs,
        detail: `HTTP ${status}: ${body.slice(0, 120)}`,
      }
    }
    const data = JSON.parse(body)
    const count: number = data.products?.length ?? 0
    return { status: 'ok', latencyMs, detail: `${count} result(s)` }
  } catch (err) {
    return { status: 'fail', detail: String(err) }
  }
}

async function probeEbay(): Promise<VendorStatus> {
  const base = env('EBAY_API_BASE')
  const appId = env('EBAY_APP_ID')
  const certId = env('EBAY_CERT_ID')
  const marketplace = env('EBAY_MARKETPLACE_ID') || 'EBAY_US'
  if (!base || !appId || !certId) {
    return {
      status: 'disabled',
      detail: 'EBAY_API_BASE, EBAY_APP_ID or EBAY_CERT_ID not set',
    }
  }
  try {
    // Token exchange
    const credentials = btoa(`${appId}:${certId}`)
    const tokenRes = await timedFetch(`${base}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    })
    if (!tokenRes.ok) {
      return {
        status: 'fail',
        latencyMs: tokenRes.latencyMs,
        detail: `token exchange HTTP ${tokenRes.status}: ${tokenRes.body.slice(0, 120)}`,
      }
    }
    const { access_token: token } = JSON.parse(tokenRes.body)
    if (!token) {
      return {
        status: 'fail',
        latencyMs: tokenRes.latencyMs,
        detail: 'token response missing access_token',
      }
    }

    // Search
    const url = new URL(`${base}/buy/browse/v1/item_summary/search`)
    url.searchParams.set('q', TEST_QUERY)
    url.searchParams.set('limit', '3')
    url.searchParams.set('category_ids', '212')
    url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}')
    const searchRes = await timedFetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplace,
      },
    })
    if (!searchRes.ok) {
      return {
        status: 'fail',
        latencyMs: tokenRes.latencyMs + searchRes.latencyMs,
        detail: `browse API HTTP ${searchRes.status}: ${searchRes.body.slice(0, 120)}`,
      }
    }
    const data = JSON.parse(searchRes.body)
    const count: number = data.itemSummaries?.length ?? 0
    return {
      status: 'ok',
      latencyMs: tokenRes.latencyMs + searchRes.latencyMs,
      detail: `token ok · ${count} listing(s)`,
    }
  } catch (err) {
    return { status: 'fail', detail: String(err) }
  }
}

async function probeCardHedge(): Promise<VendorStatus> {
  const base = env('CARDHEDGE_API_BASE')
  const key = env('CARDHEDGE_API_KEY')
  if (!base || !key) {
    return {
      status: 'disabled',
      detail: 'CARDHEDGE_API_BASE or CARDHEDGE_API_KEY not set',
    }
  }
  try {
    const { ok, status, latencyMs, body } = await timedFetch(`${base}/v1/cards/card-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({ search: TEST_QUERY, page_size: 3 }),
    })
    if (!ok) {
      return {
        status: 'fail',
        latencyMs,
        detail: `HTTP ${status}: ${body.slice(0, 120)}`,
      }
    }
    const data = JSON.parse(body)
    const count: number = data.cards?.length ?? 0
    return { status: 'ok', latencyMs, detail: `${count} card(s)` }
  } catch (err) {
    return { status: 'fail', detail: String(err) }
  }
}

// ─── handler ─────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const [pricecharting, ebay, cardhedge] = await Promise.all([
    probePriceCharting(),
    probeEbay(),
    probeCardHedge(),
  ])

  const vendors = { pricecharting, ebay, cardhedge }
  const anyFailed = Object.values(vendors).some((v) => v.status === 'fail')
  const httpStatus = anyFailed ? 503 : 200

  const body = JSON.stringify({
    ok: !anyFailed,
    checkedAt: new Date().toISOString(),
    vendors,
  })

  return new Response(body, {
    status: httpStatus,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
})
