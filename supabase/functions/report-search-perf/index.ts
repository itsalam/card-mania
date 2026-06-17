/**
 * report-search-perf — client perf reporting endpoint.
 *
 * POST { render_ms: number }
 *   Inserts one sample into search_perf_samples and returns the current
 *   server-computed prefetch_enabled flag from search_config so the client
 *   can cache it locally.
 *
 * Response: { prefetch_enabled: boolean }
 */
import { corsHeaders, createSupabaseServiceClient } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const ch = corsHeaders(origin, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: Object.keys(ch).length ? 204 : 403, headers: ch })
  }

  const json = (v: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(v), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...ch, ...(init.headers ?? {}) },
    })

  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, { status: 405 })
  }

  let render_ms: unknown
  try {
    const body = await req.json()
    render_ms = body?.render_ms
  } catch {
    return json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (typeof render_ms !== 'number' || !Number.isFinite(render_ms) || render_ms < 0) {
    return json({ error: 'render_ms must be a non-negative number' }, { status: 400 })
  }

  const supabase = createSupabaseServiceClient()

  const [insertResult, cfgResult] = await Promise.all([
    supabase.from('search_perf_samples').insert({ render_ms: Math.round(render_ms) }),
    supabase.from('search_config').select('prefetch_enabled').eq('id', 1).single(),
  ])

  if (insertResult.error) {
    console.error('report-search-perf: insert error', insertResult.error)
  }

  const prefetch_enabled = cfgResult.data?.prefetch_enabled ?? false

  return json({ prefetch_enabled })
})
