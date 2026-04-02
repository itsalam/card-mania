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
import { createSupabaseServiceClient } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'authorization,content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let render_ms: unknown
  try {
    const body = await req.json()
    render_ms = body?.render_ms
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (typeof render_ms !== 'number' || !Number.isFinite(render_ms) || render_ms < 0) {
    return new Response(JSON.stringify({ error: 'render_ms must be a non-negative number' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
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

  return new Response(JSON.stringify({ prefetch_enabled }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
