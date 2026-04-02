/**
 * search-warmup — scheduled cache-warming + adaptive prefetch toggle.
 *
 * Runs hourly (configured via schedule in config.toml).
 *
 * 1. Warms the price-charting server-side cache with the default suggestion query.
 * 2. Reads search_perf_samples from the last 24 h, computes the p75 render latency,
 *    and updates search_config.prefetch_enabled based on whether p75 exceeds the
 *    configured threshold. This drives the app-wide adaptive prefetch decision.
 */
import { createSupabaseServiceClient } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const DEFAULT_QUERY = 'baseball-cards-2025-topps'
const DEFAULT_LIMIT = 8
const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours
const MIN_SAMPLES = 5 // don't flip the flag without at least this many data points

function computeP75(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * 0.75)
  return sorted[Math.min(idx, sorted.length - 1)]
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    console.error('search-warmup: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return new Response(JSON.stringify({ ok: false, error: 'missing env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Step 1: Warm the price-charting cache ────────────────────────────────────
  const pcUrl = new URL(`${supabaseUrl}/functions/v1/price-charting`)
  pcUrl.searchParams.set('q', DEFAULT_QUERY)
  pcUrl.searchParams.set('limit', String(DEFAULT_LIMIT))
  pcUrl.searchParams.set('commit_images', 'true')

  const warmStart = Date.now()
  let warmResult: { ok: boolean; latencyMs: number; results?: number; error?: string }

  try {
    const res = await fetch(pcUrl.toString(), {
      headers: { Authorization: `Bearer ${supabaseKey}`, 'x-internal': '1' },
    })
    const latencyMs = Date.now() - warmStart

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`search-warmup: price-charting returned ${res.status}`, body.slice(0, 200))
      warmResult = { ok: false, latencyMs, error: `HTTP ${res.status}` }
    } else {
      const data = await res.json()
      const count: number = data?.results?.length ?? 0
      console.log(`search-warmup: warmed cache in ${latencyMs}ms, ${count} result(s)`)
      warmResult = { ok: true, latencyMs, results: count }
    }
  } catch (err) {
    warmResult = { ok: false, latencyMs: Date.now() - warmStart, error: String(err) }
    console.error('search-warmup: fetch error', err)
  }

  // ── Step 2: Compute p75 and update prefetch_enabled ──────────────────────────
  const supabase = createSupabaseServiceClient()

  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { data: samples, error: samplesErr } = await supabase
    .from('search_perf_samples')
    .select('render_ms')
    .gte('created_at', since)

  let prefetchUpdate: { prefetch_enabled?: boolean; p75?: number | null; samples?: number } = {}

  if (samplesErr) {
    console.error('search-warmup: failed to fetch perf samples', samplesErr)
  } else {
    const values = (samples ?? []).map((r) => r.render_ms)
    const p75 = computeP75(values)
    console.log(`search-warmup: ${values.length} sample(s) in last 24h, p75=${p75}ms`)

    if (values.length >= MIN_SAMPLES && p75 !== null) {
      const { data: cfg } = await supabase
        .from('search_config')
        .select('prefetch_threshold_ms')
        .eq('id', 1)
        .single()

      const threshold = cfg?.prefetch_threshold_ms ?? 500
      const prefetch_enabled = p75 > threshold

      const { error: updateErr } = await supabase
        .from('search_config')
        .update({ prefetch_enabled })
        .eq('id', 1)

      if (updateErr) {
        console.error('search-warmup: failed to update prefetch_enabled', updateErr)
      } else {
        console.log(
          `search-warmup: prefetch_enabled=${prefetch_enabled} (p75=${p75}ms, threshold=${threshold}ms)`
        )
      }

      prefetchUpdate = { prefetch_enabled, p75, samples: values.length }
    } else {
      console.log(
        `search-warmup: skipping prefetch update (${values.length} samples, need ${MIN_SAMPLES})`
      )
      prefetchUpdate = { p75, samples: values.length }
    }
  }

  return new Response(JSON.stringify({ warm: warmResult, perf: prefetchUpdate }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
