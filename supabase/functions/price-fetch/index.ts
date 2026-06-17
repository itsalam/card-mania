import { corsHeaders, createSupabaseClient } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const json = (v: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(v), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const ch = corsHeaders(origin, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: Object.keys(ch).length ? 204 : 403, headers: ch })
  }

  // Shadow module-level json so every response gets CORS headers automatically.
  const json = (v: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(v), {
      ...init,
      headers: { 'content-type': 'application/json', ...ch, ...(init.headers ?? {}) },
    })

  const { mock_data, grade, card_id } = await req.json()
  const supabase = createSupabaseClient(req)

  // ── Mock mode: only when the caller explicitly opts in ───────────────────────
  // Never used as a silent fallback — this is a dev/debug path only.
  if (mock_data && typeof mock_data.end_cost === 'number') {
    const { end_cost } = mock_data
    const days = 90
    const MS_DAY = 86_400_000
    const startOfUTCDay = (ts: number) => {
      const d = new Date(ts)
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    }
    const endMs = startOfUTCDay(Date.now())
    const startMs = endMs - (days - 1) * MS_DAY
    const startCost = end_cost * 0.8 + Math.random() * end_cost * 0.4
    const priceData = Array.from({ length: days }, (_, i) => {
      const t = startMs + i * MS_DAY
      const progress = i / (days - 1)
      const trend = startCost + (end_cost - startCost) * progress
      const variation = trend * 0.1
      const price = i === days - 1 ? end_cost : trend + (Math.random() * 2 - 1) * variation
      return { date: t, [grade]: Math.max(0, Math.round(price)) }
    })
    return json(priceData)
  }

  // ── Real data path ───────────────────────────────────────────────────────────
  if (!card_id || !grade) {
    return json({ error: 'card_id and grade are required' }, { status: 400 })
  }

  const { data: history, error } = await supabase
    .from('card_price_history')
    .select('price_cents, recorded_at')
    .eq('card_id', card_id)
    .eq('grade', grade)
    .order('recorded_at', { ascending: true })

  if (error) {
    console.error('[price-fetch] history query failed:', error)
    return json({ error: 'Failed to query price history' }, { status: 500 })
  }

  if (history && history.length > 0) {
    const priceData = history.map(({ price_cents, recorded_at }) => ({
      date: new Date(recorded_at).getTime(),
      [grade]: price_cents,
    }))
    return json(priceData)
  }

  // ── No history yet — two-phase backfill ─────────────────────────────────────
  const supaUrl = Deno.env.get('SUPABASE_URL')
  const srole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (supaUrl && srole) {
    const historyBase = `${supaUrl}/functions/v1/fetch-card-history`
    const headers = { Authorization: `Bearer ${srole}` }

    // Phase 1 — synchronous 30-day fetch.
    // Blocks until the minimum viable window is written so this request can
    // return real data rather than a pending signal.
    try {
      await fetch(`${historyBase}?card_id=${card_id}&days=30`, { headers })
    } catch (e) {
      console.error('[price-fetch] 30-day backfill failed:', e)
    }

    // Re-query for the rows just written.
    const { data: freshHistory } = await supabase
      .from('card_price_history')
      .select('price_cents, recorded_at')
      .eq('card_id', card_id)
      .eq('grade', grade)
      .order('recorded_at', { ascending: true })

    if (freshHistory && freshHistory.length > 0) {
      // Phase 2 — background 180-day enrichment.
      // ignoreDuplicates on the upsert means the 30 rows already present are
      // skipped; only the remaining ~150 days are inserted.
      EdgeRuntime.waitUntil(
        fetch(`${historyBase}?card_id=${card_id}`, { headers }).catch((e) =>
          console.error('[price-fetch] full backfill failed:', e)
        )
      )

      return json(
        freshHistory.map(({ price_cents, recorded_at }) => ({
          date: new Date(recorded_at).getTime(),
          [grade]: price_cents,
        }))
      )
    }
  }

  // Last resort: Phase 1 failed or credentials unavailable.
  return json({ pending: true, data: [] })
})
