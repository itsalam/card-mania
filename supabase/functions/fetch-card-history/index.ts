// Backfills card_price_history from CardHedge's /v1/cards/prices-by-card endpoint.
//
// Lookup strategy (in order):
//   1. Check external_refs for an existing CardHedge ID (persisted data from a
//      prior fetch-card run).
//   2. If none found, call /v1/cards/card-match using the card's name + set_name
//      as the query. Accept matches at or above CARDHEDGE_MATCH_THRESHOLD
//      (default 0.8, configurable via env var). On success, persist the new
//      external_ref so future calls skip this step.
//
// Grade discovery:
//   - When the CardHedge ID came from external_refs: derive grades from
//     cards.grades_prices keys (reuses data from an existing fetch-card call).
//   - When the CardHedge ID came from card-match: use the grade labels in the
//     match response directly — they are already in CardHedge format and we
//     avoid an extra round-trip.
//
// Idempotency:
//   The unique index on card_price_history(card_id, grade, day) means re-running
//   the backfill for an already-backfilled card is a no-op.

import { fetchCardHedgeHistory, fetchCardHedgeMatch } from '@cardhedge'
import { createSupabaseServiceClient, normalizeGradeKey, toCardHedgeGradeLabel } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const DEFAULT_MATCH_THRESHOLD = 0.8

Deno.serve(async (req) => {
  // ── Internal-only guard ───────────────────────────────────────────────────────
  // verify_jwt = false so Supabase doesn't check a user JWT, but we still require
  // the caller to present the service role key. This key is only available as an
  // env var inside edge functions — external clients cannot obtain it.
  const sroleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!sroleKey || authHeader !== `Bearer ${sroleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { searchParams } = new URL(req.url)
  const card_id = searchParams.get('card_id')
  const days = searchParams.get('days') ? Number(searchParams.get('days')) : undefined

  if (!card_id) {
    return new Response(JSON.stringify({ error: 'card_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const chBase = Deno.env.get('CARDHEDGE_API_BASE')
  const chKey = Deno.env.get('CARDHEDGE_API_KEY')

  if (!chBase || !chKey) {
    return new Response(JSON.stringify({ error: 'CardHedge credentials not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const matchThreshold = Number(
    Deno.env.get('CARDHEDGE_MATCH_THRESHOLD') ?? DEFAULT_MATCH_THRESHOLD
  )

  const supabase = createSupabaseServiceClient()

  // ── Fetch the card so we can build a match query if needed ───────────────────
  const { data: card } = await supabase
    .from('cards')
    .select('name, set_name, grades_prices')
    .eq('id', card_id)
    .maybeSingle()

  if (!card) {
    return new Response(JSON.stringify({ error: 'Card not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 1. Resolve CardHedge external_id ─────────────────────────────────────────
  // gradeMap pairs our internal grade key with the CardHedge label to request.
  // Populated from grades_prices (existing-ref path) or match.prices (match path).
  let chCardId: string | null = null
  let gradeMap: Array<{ internalKey: string; chLabel: string }> = []

  const { data: ref } = await supabase
    .from('external_refs')
    .select('external_id')
    .eq('card_id', card_id)
    .eq('provider', 'cardhedge')
    .maybeSingle()

  if (ref?.external_id) {
    // ── Path A: external_ref already exists ──────────────────────────────────
    chCardId = ref.external_id

    // Derive grades from persisted grades_prices; skip keys that don't map to
    // a CardHedge label (e.g. PriceCharting-only grades we can't round-trip).
    const gradesPrices = (card.grades_prices ?? {}) as Record<string, number>
    gradeMap = Object.keys(gradesPrices)
      .map((key) => ({ internalKey: key, chLabel: toCardHedgeGradeLabel(key) ?? '' }))
      .filter((g) => g.chLabel !== '')
  } else {
    // ── Path B: no external_ref — attempt card-match ──────────────────────────
    const query = `${card.name ?? ''} ${card.set_name ?? ''}`.trim()

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Card has no name/set to build a match query from' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    }

    let matchResp
    try {
      matchResp = await fetchCardHedgeMatch(query, chKey, chBase)
    } catch (err) {
      console.error('[fetch-card-history] card-match failed:', err)
      return new Response(JSON.stringify({ error: 'CardHedge card-match request failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const match = matchResp.match
    if (!match || match.confidence < matchThreshold) {
      console.debug('[fetch-card-history] no confident match', {
        card_id,
        query,
        confidence: match?.confidence ?? null,
        threshold: matchThreshold,
      })
      return new Response(
        JSON.stringify({
          message: 'No CardHedge match met the confidence threshold',
          confidence: match?.confidence ?? null,
          threshold: matchThreshold,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    chCardId = match.card_id

    // Persist the new external_ref so future calls take Path A
    await supabase
      .from('external_refs')
      .upsert(
        { provider: 'cardhedge', external_id: chCardId, card_id, suggested_uuid: card_id },
        { onConflict: 'provider,external_id', ignoreDuplicates: true }
      )

    // Use the grade labels already in CardHedge format from the match response.
    // This avoids a round-trip and guarantees we only request grades the API knows.
    gradeMap = (match.prices ?? []).map(({ grade }) => ({
      internalKey: normalizeGradeKey(grade),
      chLabel: grade,
    }))

    console.debug('[fetch-card-history] card-match succeeded', {
      card_id,
      chCardId,
      confidence: match.confidence,
      grades: gradeMap.length,
    })
  }

  if (!gradeMap.length) {
    return new Response(JSON.stringify({ message: 'No grades to backfill for this card' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 2. Fan out history calls per grade ────────────────────────────────────────
  const results = await Promise.allSettled(
    gradeMap.map(async ({ internalKey, chLabel }) => {
      const points = await fetchCardHedgeHistory(chCardId!, chLabel, chKey, chBase, days)
      return { internalKey, points }
    })
  )

  // ── 3. Collect + upsert all price points ──────────────────────────────────────
  const historyRows: Array<{
    card_id: string
    grade: string
    price_cents: number
    recorded_at: string
  }> = []

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[fetch-card-history] grade fetch failed:', result.reason)
      continue
    }
    const { internalKey, points } = result.value
    for (const point of points) {
      const priceVal = parseFloat(point.price)
      if (isNaN(priceVal) || priceVal <= 0) continue
      historyRows.push({
        card_id,
        grade: internalKey,
        price_cents: Math.round(priceVal * 100),
        recorded_at: point.closing_date,
      })
    }
  }

  if (historyRows.length) {
    const { error } = await supabase
      .from('card_price_history')
      .upsert(historyRows, { ignoreDuplicates: true, onConflict: 'card_id,grade,recorded_date' })

    if (error) {
      console.error('[fetch-card-history] upsert failed:', error)
      return new Response(JSON.stringify({ error: 'History upsert failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  console.debug('[fetch-card-history] done', {
    card_id,
    chCardId,
    grades: gradeMap.length,
    rows: historyRows.length,
  })

  return new Response(
    JSON.stringify({
      card_id,
      ch_card_id: chCardId,
      grades_fetched: gradeMap.length,
      rows_inserted: historyRows.length,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
