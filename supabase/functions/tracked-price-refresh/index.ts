// tracked-price-refresh — scheduled CardHedger price refresh for tracked cards.
//
// Scheduled by 20261025000003_tracked_price_refresh_cron.sql. Claims a lease-protected batch
// of stale tracked cards (wishlisted or held in a collection — claim_cards_for_price_refresh),
// resolves each to a CardHedger card_id (@cardhedge-resolve: external_refs → exact vendorUUID
// match in card-search → guarded card-match), pulls the latest price for every grade in one
// all-prices-by-card call, and applies it with apply_card_price_refresh (merges grades_prices,
// writes card_price_history, releases the lease; totals triggers follow).
//
// Misses are terminal for the retry window (unresolved / no_prices / error — see the claim
// RPC); rate limiting is not: the run stops and releases every remaining lease without
// counting an attempt. card-match is an AI call, so it's capped per run
// (PRICE_REFRESH_MAX_RESOLVES); cards needing one beyond the cap are released untouched.
//
// Observability: price_refresh_runs / card_price_refresh_attempts (pg_net times out before a
// batch finishes, so the cron's own logs can't say how a run went). Ledger writes are
// best-effort. POST { "card_ids": [...] } refreshes specific cards (manual checks) instead of
// claiming.
import { fetchCardHedgeAllPrices, fetchCardHedgeMatch, fetchCardHedgeResults } from '@cardhedge'
import { mapAllPrices, RateLimitedError } from '@cardhedge-prices'
import { resolveCardHedgeId } from '@cardhedge-resolve'
import { isServiceRequest } from '@service-auth'
import { createSupabaseServiceClient, logEvent, rid, vendorUUID } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const BATCH_SIZE = Number(Deno.env.get('PRICE_REFRESH_BATCH_SIZE') ?? '25')
const LEASE_SECONDS = Number(Deno.env.get('PRICE_REFRESH_LEASE_SECONDS') ?? '600')
const STALE_HOURS = Number(Deno.env.get('PRICE_REFRESH_STALE_HOURS') ?? '24')
const THROTTLE_MS = Number(Deno.env.get('PRICE_REFRESH_THROTTLE_MS') ?? '300')
// Max card-match (AI) resolutions per run; the rest wait for a later run.
const MAX_RESOLVES = Number(Deno.env.get('PRICE_REFRESH_MAX_RESOLVES') ?? '5')
// Stop picking up new cards after this long so a run never outlives its lease.
const TIME_BUDGET_MS = Number(Deno.env.get('PRICE_REFRESH_TIME_BUDGET_MS') ?? '90000')
const MATCH_THRESHOLD = Number(Deno.env.get('CARDHEDGE_MATCH_THRESHOLD') ?? '0.8')
const NAME_SCORE_THRESHOLD = Number(Deno.env.get('PRICE_REFRESH_NAME_SCORE') ?? '0.7')
const SEARCH_LIMIT = 10

const supabase = createSupabaseServiceClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

type ClaimedCard = {
  id: string
  name: string | null
  set_name: string | null
  genre: string | null
  cardhedge_id: string | null
}
type Outcome =
  | 'refreshed'
  | 'unchanged'
  | 'resolved_exact'
  | 'resolved_match'
  | 'low_confidence'
  | 'no_results'
  | 'ref_conflict'
  | 'no_prices'
  | 'rate_limited'
  | 'error'
type Attempt = {
  outcome: Outcome
  cardhedgeId?: string
  confidence?: number
  description?: string
  grades?: number
  error?: string
}

Deno.serve(async (req) => {
  const reqId = rid()
  if (!isServiceRequest(req)) return json({ error: 'Unauthorized' }, 401)

  const apiBase = Deno.env.get('CARDHEDGE_API_BASE') ?? ''
  const apiKey = Deno.env.get('CARDHEDGE_API_KEY') ?? ''
  if (!apiBase || !apiKey) {
    logEvent('warn', reqId, 'price_refresh.skipped', { reason: 'cardhedge_not_configured' })
    await startRun(reqId, 'skipped')
    return json({ ok: true, claimed: 0, skipped: 'cardhedge_not_configured' })
  }

  const body = await req.json().catch(() => ({}))
  const manualIds: string[] | undefined = Array.isArray(body?.card_ids) ? body.card_ids : undefined
  const runId = await startRun(reqId, 'running')

  let cards: ClaimedCard[]
  try {
    cards = manualIds ? await loadCards(manualIds) : await claim()
  } catch (err) {
    logEvent('error', reqId, 'price_refresh.claim_failed', { error: String(err) })
    await finishRun(reqId, runId, { status: 'failed', error: String(err) })
    return json({ ok: false, error: 'claim_failed' }, 500)
  }
  logEvent('info', reqId, 'price_refresh.claimed', {
    runId,
    count: cards.length,
    manual: !!manualIds,
  })

  const started = Date.now()
  const stats = { refreshed: 0, unchanged: 0, unresolved: 0, failed: 0, resolves_used: 0 }
  let status: 'completed' | 'rate_limited' = 'completed'

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (Date.now() - started > TIME_BUDGET_MS) {
      await release(cards.slice(i).map((c) => c.id))
      break
    }
    const attempts: Attempt[] = []
    try {
      const resolved = await resolveCardHedgeId(card, {
        search: (q) => fetchCardHedgeResults(q, apiKey, apiBase, SEARCH_LIMIT),
        match: (q) => {
          stats.resolves_used++
          return fetchCardHedgeMatch(q, apiKey, apiBase, { maxCandidates: 10 })
        },
        vendorUUID: (chId) => vendorUUID('cardhedge', chId),
        matchThreshold: MATCH_THRESHOLD,
        nameScoreThreshold: NAME_SCORE_THRESHOLD,
        allowMatch: stats.resolves_used < MAX_RESOLVES,
      })

      if ('miss' in resolved) {
        if (resolved.miss === 'budget') {
          await release([card.id])
          continue
        }
        attempts.push({
          outcome: resolved.miss,
          confidence: resolved.confidence,
          description: resolved.description,
        })
        await mark(card.id, 'unresolved')
        stats.unresolved++
        continue
      }

      if (resolved.via !== 'ref') {
        attempts.push({
          outcome: resolved.via === 'exact' ? 'resolved_exact' : 'resolved_match',
          cardhedgeId: resolved.id,
          confidence: resolved.confidence,
          description: resolved.description,
        })
        const conflict = await persistRef(resolved.id, card.id)
        if (conflict) attempts.push({ outcome: 'ref_conflict', cardhedgeId: resolved.id })
      }

      const { grades_prices, latestPriceCents, unmapped } = mapAllPrices(
        await fetchCardHedgeAllPrices(resolved.id, apiKey, apiBase)
      )
      if (unmapped.length) {
        logEvent('warn', reqId, 'price_refresh.unmapped_grades', { cardId: card.id, unmapped })
      }
      const grades = Object.keys(grades_prices).length
      if (!grades) {
        attempts.push({ outcome: 'no_prices', cardhedgeId: resolved.id })
        await mark(card.id, 'no_prices')
        stats.unchanged++
        continue
      }

      const { data, error } = await supabase.rpc('apply_card_price_refresh', {
        p_card_id: card.id,
        p_prices: grades_prices,
        p_latest_price_cents: latestPriceCents,
      })
      if (error) throw error
      const changed = Boolean((data as { changed?: boolean } | null)?.changed)
      attempts.push({
        outcome: changed ? 'refreshed' : 'unchanged',
        cardhedgeId: resolved.id,
        grades,
      })
      if (changed) stats.refreshed++
      else stats.unchanged++
    } catch (err) {
      if (err instanceof RateLimitedError) {
        attempts.push({ outcome: 'rate_limited' })
        await release(cards.slice(i).map((c) => c.id))
        status = 'rate_limited'
        logEvent('warn', reqId, 'price_refresh.rate_limited', {
          cardId: card.id,
          remaining: cards.length - i,
        })
        await recordAttempts(reqId, runId, card.id, attempts)
        break
      }
      attempts.push({ outcome: 'error', error: String(err) })
      stats.failed++
      logEvent('error', reqId, 'price_refresh.card_failed', { cardId: card.id, error: String(err) })
      await mark(card.id, 'error').catch(() => {})
    } finally {
      if (status !== 'rate_limited') await recordAttempts(reqId, runId, card.id, attempts)
    }
    if (THROTTLE_MS > 0 && i < cards.length - 1) await sleep(THROTTLE_MS)
  }

  await finishRun(reqId, runId, { status, claimed: cards.length, ...stats })
  logEvent('info', reqId, 'price_refresh.done', { runId, status, claimed: cards.length, ...stats })
  return json({ ok: true, status, claimed: cards.length, ...stats })
})

async function claim(): Promise<ClaimedCard[]> {
  const { data, error } = await supabase.rpc('claim_cards_for_price_refresh', {
    p_limit: BATCH_SIZE,
    p_lease_seconds: LEASE_SECONDS,
    p_stale_hours: STALE_HOURS,
  })
  if (error) throw error
  return (data ?? []) as ClaimedCard[]
}

async function loadCards(ids: string[]): Promise<ClaimedCard[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, set_name, genre, external_refs(provider, external_id)')
    .in('id', ids)
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    set_name: c.set_name,
    genre: c.genre,
    cardhedge_id:
      (c.external_refs as { provider: string; external_id: string }[] | null)?.find(
        (r) => r.provider === 'cardhedge'
      )?.external_id ?? null,
  }))
}

/** Returns true when this CardHedger id already belongs to another card (not persisted). */
async function persistRef(cardhedgeId: string, cardId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('external_refs')
    .select('card_id')
    .eq('provider', 'cardhedge')
    .eq('external_id', cardhedgeId)
    .maybeSingle()
  if (existing && existing.card_id !== cardId) return true
  if (!existing) {
    const { error } = await supabase.from('external_refs').insert({
      provider: 'cardhedge',
      external_id: cardhedgeId,
      card_id: cardId,
      suggested_uuid: cardId,
    })
    if (error && error.code !== '23505') throw error
  }
  return false
}

async function mark(cardId: string, status: 'unresolved' | 'no_prices' | 'error') {
  const { error } = await supabase.rpc('mark_card_price_refresh', {
    p_card_id: cardId,
    p_status: status,
  })
  if (error) throw error
}

async function release(cardIds: string[]) {
  if (!cardIds.length) return
  const { error } = await supabase.rpc('release_card_price_refresh', { p_card_ids: cardIds })
  if (error)
    logEvent('warn', 'release', 'price_refresh.release_failed', { error: String(error.message) })
}

async function startRun(reqId: string, status: 'running' | 'skipped'): Promise<string | null> {
  const { data, error } = await supabase
    .from('price_refresh_runs')
    .insert({
      req_id: reqId,
      status,
      finished_at: status === 'skipped' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (error) {
    logEvent('warn', reqId, 'price_refresh.ledger_failed', {
      op: 'start_run',
      error: String(error.message),
    })
    return null
  }
  return data.id
}

async function finishRun(reqId: string, runId: string | null, fields: Record<string, unknown>) {
  if (!runId) return
  const { error } = await supabase
    .from('price_refresh_runs')
    .update({ ...fields, finished_at: new Date().toISOString() })
    .eq('id', runId)
  if (error)
    logEvent('warn', reqId, 'price_refresh.ledger_failed', {
      op: 'finish_run',
      error: String(error.message),
    })
}

async function recordAttempts(
  reqId: string,
  runId: string | null,
  cardId: string,
  attempts: Attempt[]
) {
  if (!runId || !attempts.length) return
  const { error } = await supabase.from('card_price_refresh_attempts').insert(
    attempts.map((a) => ({
      run_id: runId,
      card_id: cardId,
      outcome: a.outcome,
      cardhedge_id: a.cardhedgeId ?? null,
      match_confidence: a.confidence ?? null,
      matched_description: a.description ?? null,
      grades: a.grades ?? null,
      error: a.error ?? null,
    }))
  )
  if (error)
    logEvent('warn', reqId, 'price_refresh.ledger_failed', {
      op: 'record_attempts',
      cardId,
      error: String(error.message),
    })
}
