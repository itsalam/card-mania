// ITS-40 Phase 2: card-enrichment-backfill (multi-vendor)
//
// Scheduled job (see 20260921000001_its40_card_enrichment_backfill_cron.sql):
// claims a lease-protected batch of public.cards rows where enriched_at is
// null, builds a query from name + set_name, and cascades through the
// image-bearing vendors of the live price-charting blend — CardHedge
// (priority 1), then eBay (priority 3) — stopping at the first vendor whose
// results contain a confident match for the card *with an image*.
//
// The durable output of enrichment is the committed card_images row (vendor
// provider_search_cache entries expire within minutes), so a vendor only
// counts as a hit if it yields an image for this card. PriceCharting returns
// no images and is therefore not part of this cascade; it's still used by the
// live search path. Each result is scored against the card's name/set
// (@enrichment-match) and only the best-scoring match above
// ENRICHMENT_MATCH_THRESHOLD is committed — a wrong image is never revisited
// once the card is terminal, so a low-confidence match is treated as a miss.
//
// A vendor's fetch throwing, returning no confident match, or its image
// failing to commit is a miss for that vendor and the cascade continues.
// Marks enriched_at on a terminal outcome (an image committed, or every
// configured vendor missed / malformed name); transient DB failures are
// logged and left unmarked so a later run retries them. The live path marks
// enriched_at too, via trg_card_images_mark_enriched on any READY card_images
// write, so cards already enriched by a live lookup are never claimed here.
//
// Observability: every run and every per-vendor attempt is recorded in
// enrichment_runs / card_enrichment_attempts (see
// 20260922000001_its40_enrichment_observability.sql — the cron's pg_net call
// times out before a batch finishes, so this ledger is the only durable record
// of how a run went). Ledger writes are best-effort and never affect
// enrichment. Logs are single-line JSON (logEvent) for the Logs Explorer.
import { pickBestMatch, scoreMatch } from '@enrichment-match'
import { isServiceRequest } from '@service-auth'
import type { CardHedgeConfig } from '@vendor-cardhedge-search'
import { fetchFromCardHedge, writeCardHedgeProviderCache } from '@vendor-cardhedge-search'
import {
  EbayConfig,
  fetchFromEbay,
  writeEbayProviderCache,
  writeImageSearchCacheHint,
} from '@ebay-search'
import { SearchResultItem } from '@types'
import {
  commitCacheFromQueryHash,
  commitCardImageFromCacheUpsert,
  createSupabaseServiceClient,
  fetchGlobalVars,
  logEvent,
  normalize,
  rid,
  sha256HexStr,
} from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const BATCH_SIZE = Number(Deno.env.get('ENRICHMENT_BATCH_SIZE') ?? '15')
const THROTTLE_MS = Number(Deno.env.get('ENRICHMENT_THROTTLE_MS') ?? '250')
// Pause between vendor calls within one card's cascade (e.g. CardHedge miss ->
// eBay). 0 = back-to-back; raise if a vendor starts pushing back.
const VENDOR_THROTTLE_MS = Number(Deno.env.get('ENRICHMENT_VENDOR_THROTTLE_MS') ?? '0')
const LEASE_SECONDS = Number(Deno.env.get('ENRICHMENT_LEASE_SECONDS') ?? '600')
// Minimum @enrichment-match score (0..1) for a result's image to be committed.
const MATCH_THRESHOLD = Number(Deno.env.get('ENRICHMENT_MATCH_THRESHOLD') ?? '0.7')

const EBAY_SEARCH_LIMIT = Number(Deno.env.get('ENRICHMENT_EBAY_LIMIT') ?? '5')
const EBAY_CACHE_TTL = Number(Deno.env.get('EBAY_CACHE_TTL') ?? '300')
const CARDHEDGE_SEARCH_LIMIT = Number(Deno.env.get('ENRICHMENT_CARDHEDGE_LIMIT') ?? '5')
const CARDHEDGE_CACHE_TTL = Number(Deno.env.get('CARDHEDGE_CACHE_TTL') ?? '300')

const supabase = createSupabaseServiceClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type ClaimedCard = { id: string; name: string; set_name: string }
type Vendor = 'cardhedge' | 'ebay'
type Hints = Map<string, { url: string; norm: string }>
type VendorSource = {
  name: Vendor
  enabled: boolean
  fetch: (q: string) => Promise<{ results: SearchResultItem[]; preknownHints: Hints }>
  writeCache: (providerQueryKey: string, results: SearchResultItem[]) => Promise<Response>
}
// Per-vendor outcome for one card (vendor null = card-level outcome), recorded
// in card_enrichment_attempts so match threshold and vendor coverage can be
// tuned from data.
type Attempt = {
  vendor: Vendor | null
  outcome:
    | 'hit'
    | 'no_results'
    | 'no_image'
    | 'no_match'
    | 'image_failed'
    | 'error'
    | 'malformed'
    | 'failed'
  results?: number
  withImage?: number
  bestScore?: number
  matchedTitle?: string
  imageUrl?: string
  error?: string
}

Deno.serve(async (req) => {
  const reqId = rid()
  if (!isServiceRequest(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { supa, srole } = fetchGlobalVars()

  const ebayCfg: EbayConfig = {
    base: Deno.env.get('EBAY_API_BASE') ?? '',
    appId: Deno.env.get('EBAY_APP_ID') ?? '',
    certId: Deno.env.get('EBAY_CERT_ID') ?? '',
    marketplace: Deno.env.get('EBAY_MARKETPLACE_ID') ?? 'EBAY_US',
  }
  const cardhedgeCfg: CardHedgeConfig = {
    apiBase: Deno.env.get('CARDHEDGE_API_BASE') ?? '',
    apiKey: Deno.env.get('CARDHEDGE_API_KEY') ?? '',
  }

  // Live blend priority order (CardHedge 1, eBay 3; PriceCharting has no images).
  const vendorSources: VendorSource[] = [
    {
      name: 'cardhedge',
      enabled: Boolean(cardhedgeCfg.apiBase && cardhedgeCfg.apiKey),
      fetch: (q) => fetchFromCardHedge(cardhedgeCfg, q, CARDHEDGE_SEARCH_LIMIT),
      writeCache: (key, results) =>
        writeCardHedgeProviderCache(supa, srole, key, results, CARDHEDGE_CACHE_TTL),
    },
    {
      name: 'ebay',
      enabled: Boolean(ebayCfg.base && ebayCfg.appId && ebayCfg.certId),
      fetch: (q) => fetchFromEbay(ebayCfg, q, EBAY_SEARCH_LIMIT),
      writeCache: (key, results) =>
        writeEbayProviderCache(supa, srole, key, results, EBAY_CACHE_TTL),
    },
  ]
  const vendors = vendorSources.filter((v) => v.enabled)

  if (!vendors.length) {
    logEvent('warn', reqId, 'backfill.skipped', { reason: 'no_vendors_configured' })
    await startRun(reqId, [], 'skipped')
    return new Response(
      JSON.stringify({ ok: true, claimed: 0, skipped: 'no_vendors_configured' }),
      { headers: { 'content-type': 'application/json' } }
    )
  }

  const { data: claimed, error: claimErr } = await supabase.rpc(
    'claim_cards_for_backfill_enrichment',
    { p_limit: BATCH_SIZE, p_lease_seconds: LEASE_SECONDS }
  )
  const runId = await startRun(
    reqId,
    vendors.map((v) => v.name),
    'running'
  )
  if (claimErr) {
    logEvent('error', reqId, 'backfill.claim_failed', { error: claimErr })
    await finishRun(reqId, runId, { status: 'failed', error: String(claimErr.message ?? claimErr) })
    return new Response(JSON.stringify({ ok: false, error: 'claim_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const cards = (claimed ?? []) as ClaimedCard[]
  logEvent('info', reqId, 'backfill.claimed', { runId, count: cards.length })
  const stats = { processed: 0, enriched: 0, noMatch: 0, failed: 0 }
  const hitsByVendor: Record<string, number> = {}

  for (const card of cards) {
    const attempts: Attempt[] = []
    try {
      const q = normalize(`${card.name ?? ''} ${card.set_name ?? ''}`.trim())
      if (!q) {
        logEvent('warn', reqId, 'backfill.malformed', { id: card.id })
        attempts.push({ vendor: null, outcome: 'malformed' })
        await markEnriched(card.id)
        await recordAttempts(reqId, runId, card.id, attempts)
        stats.processed++
        stats.noMatch++
        await sleep(THROTTLE_MS)
        continue
      }

      const queryHash = await sha256HexStr(`${q}:{}`)
      let hit: { vendor: Vendor; score: number; title: string } | null = null

      for (const v of vendors) {
        if (attempts.length) await sleep(VENDOR_THROTTLE_MS)
        let fetched: Awaited<ReturnType<VendorSource['fetch']>>
        try {
          fetched = await v.fetch(q)
        } catch (err) {
          attempts.push({ vendor: v.name, outcome: 'error', error: String(err) })
          continue
        }
        const { results, preknownHints } = fetched
        const hasImage = (r: SearchResultItem) =>
          Boolean(r.card.image?.query_hash && preknownHints.has(r.card.image.query_hash))
        const withImage = results.filter(hasImage)
        const attempt: Attempt = {
          vendor: v.name,
          outcome: 'no_results',
          results: results.length,
          withImage: withImage.length,
        }
        attempts.push(attempt)
        if (!withImage.length) {
          if (results.length) attempt.outcome = 'no_image'
          continue
        }

        const match = pickBestMatch(card, withImage, MATCH_THRESHOLD)
        if (!match) {
          const [top] = withImage
            .map((r) => ({ r, score: scoreMatch(card, r) }))
            .sort((a, b) => b.score - a.score)
          attempt.outcome = 'no_match'
          attempt.bestScore = round(top.score)
          attempt.matchedTitle = top.r.card.name
          continue
        }
        const qHash = match.best.card.image!.query_hash!
        const hint = preknownHints.get(qHash)!
        attempt.bestScore = round(match.score)
        attempt.matchedTitle = match.best.card.name
        attempt.imageUrl = hint.url

        const hintRes = await writeImageSearchCacheHint(supa, srole, qHash, hint)
        if (!hintRes.ok) throw new Error(`image_search_cache write ${hintRes.status}`)
        // A failed commit (dead/blocked image URL, non-image body) is a miss
        // for this vendor rather than a retryable failure — retrying the same
        // URL next run would fail the same way and starve the claim queue.
        const commitErr = await Promise.resolve(
          commitCardImageFromCacheUpsert(
            { card_id: card.id, kind: 'front' },
            await commitCacheFromQueryHash(qHash, 1, supabase),
            supabase
          )
        ).then(
          (res: any) => res?.error,
          (err: unknown) => err
        )
        if (commitErr) {
          attempt.outcome = 'image_failed'
          attempt.error = String(commitErr?.message ?? commitErr)
          continue
        }

        attempt.outcome = 'hit'
        hit = { vendor: v.name, score: match.score, title: match.best.card.name }
        // Warm the live search cache for this card's canonical query. Short
        // TTL and the image above is the durable result, so best-effort only.
        const cacheRes = await v
          .writeCache(await sha256HexStr(`${v.name}:${queryHash}`), results)
          .catch((err) => ({ ok: false, status: String(err) }) as const)
        if (!cacheRes.ok)
          logEvent('warn', reqId, 'backfill.provider_cache_failed', {
            id: card.id,
            vendor: v.name,
            status: cacheRes.status,
          })
        break
      }

      await markEnriched(card.id)
      stats.processed++
      if (hit) {
        stats.enriched++
        hitsByVendor[hit.vendor] = (hitsByVendor[hit.vendor] ?? 0) + 1
      } else {
        stats.noMatch++
      }
      logEvent('info', reqId, hit ? 'backfill.enriched' : 'backfill.no_match', {
        id: card.id,
        name: card.name,
        set_name: card.set_name,
        vendorHit: hit?.vendor ?? null,
        matchScore: hit ? round(hit.score) : null,
        matchedTitle: hit?.title ?? null,
        attempts,
      })
      await recordAttempts(reqId, runId, card.id, attempts)
    } catch (err) {
      // Per-card failure: log, skip, leave enriched_at null for retry, and
      // release the lease early so a crash-mid-batch row is reclaimable
      // well before LEASE_SECONDS elapses.
      stats.failed++
      logEvent('error', reqId, 'backfill.card_failed', {
        id: card.id,
        error: String(err),
        attempts,
      })
      attempts.push({ vendor: null, outcome: 'failed', error: String(err) })
      await recordAttempts(reqId, runId, card.id, attempts)
      const { error: releaseErr } = await supabase
        .from('cards')
        .update({ enrichment_locked_at: null })
        .eq('id', card.id)
      if (releaseErr)
        logEvent('error', reqId, 'backfill.lease_release_failed', {
          id: card.id,
          error: String(releaseErr),
        })
    }
    await sleep(THROTTLE_MS)
  }

  const summary = { ok: true, claimed: cards.length, ...stats, hitsByVendor }
  logEvent('info', reqId, 'backfill.run_complete', { runId, ...summary })
  await finishRun(reqId, runId, {
    status: 'completed',
    claimed: cards.length,
    enriched: stats.enriched,
    no_match: stats.noMatch,
    failed: stats.failed,
    hits_by_vendor: hitsByVendor,
  })
  return new Response(JSON.stringify(summary), {
    headers: { 'content-type': 'application/json' },
  })
})

const round = (n: number) => Math.round(n * 100) / 100

async function markEnriched(cardId: string) {
  const { error } = await supabase
    .from('cards')
    .update({ enriched_at: new Date().toISOString(), enrichment_locked_at: null })
    .eq('id', cardId)
  if (error) throw error
}

async function startRun(
  reqId: string,
  vendors: Vendor[],
  status: 'running' | 'skipped'
): Promise<string | null> {
  const { data, error } = await supabase
    .from('enrichment_runs')
    .insert({
      req_id: reqId,
      vendors,
      status,
      finished_at: status === 'skipped' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (error) {
    logEvent('warn', reqId, 'backfill.ledger_failed', {
      op: 'start_run',
      error: String(error.message ?? error),
    })
    return null
  }
  return data.id
}

async function finishRun(reqId: string, runId: string | null, fields: Record<string, unknown>) {
  if (!runId) return
  const { error } = await supabase
    .from('enrichment_runs')
    .update({ ...fields, finished_at: new Date().toISOString() })
    .eq('id', runId)
  if (error)
    logEvent('warn', reqId, 'backfill.ledger_failed', {
      op: 'finish_run',
      error: String(error.message ?? error),
    })
}

async function recordAttempts(
  reqId: string,
  runId: string | null,
  cardId: string,
  attempts: Attempt[]
) {
  if (!runId || !attempts.length) return
  const { error } = await supabase.from('card_enrichment_attempts').insert(
    attempts.map((a) => ({
      run_id: runId,
      card_id: cardId,
      vendor: a.vendor,
      outcome: a.outcome,
      results: a.results ?? null,
      with_image: a.withImage ?? null,
      best_score: a.bestScore ?? null,
      matched_title: a.matchedTitle ?? null,
      image_url: a.imageUrl ?? null,
      error: a.error ?? null,
    }))
  )
  if (error)
    logEvent('warn', reqId, 'backfill.ledger_failed', {
      op: 'record_attempts',
      cardId,
      error: String(error.message ?? error),
    })
}
