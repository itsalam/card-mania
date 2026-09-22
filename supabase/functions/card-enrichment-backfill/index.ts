// ITS-40: card-enrichment-backfill
//
// Scheduled job (see 20260921000001_its40_card_enrichment_backfill_cron.sql):
// claims a lease-protected batch of public.cards rows where enriched_at is
// null, builds an eBay query from name + set_name, and reuses the same
// eBay search / provider-cache / image-commit pipeline the live
// price-charting lazy path uses (via @ebay-search and @utils) so nothing
// new is added to the cache layer. Marks enriched_at on a terminal outcome
// (success or confirmed no-match/malformed name); transient failures are
// logged and left unmarked so a later run retries them.
import {
  EbayConfig,
  fetchFromEbay,
  writeEbayProviderCache,
  writeImageSearchCacheHint,
} from '@ebay-search'
import {
  commitCacheFromQueryHash,
  commitCardImageFromCacheUpsert,
  createSupabaseServiceClient,
  fetchGlobalVars,
  logErr,
  logInfo,
  logWarn,
  normalize,
  rid,
  sha256HexStr,
} from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const BATCH_SIZE = Number(Deno.env.get('ENRICHMENT_BATCH_SIZE') ?? '15')
const THROTTLE_MS = Number(Deno.env.get('ENRICHMENT_THROTTLE_MS') ?? '250')
const LEASE_SECONDS = Number(Deno.env.get('ENRICHMENT_LEASE_SECONDS') ?? '600')
const EBAY_SEARCH_LIMIT = Number(Deno.env.get('ENRICHMENT_EBAY_LIMIT') ?? '5')
const EBAY_CACHE_TTL = Number(Deno.env.get('EBAY_CACHE_TTL') ?? '300')

const supabase = createSupabaseServiceClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type ClaimedCard = { id: string; name: string; set_name: string }

Deno.serve(async (req) => {
  const reqId = rid()
  const sroleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!sroleKey || authHeader !== `Bearer ${sroleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { supa, srole } = fetchGlobalVars()
  const cfg: EbayConfig = {
    base: Deno.env.get('EBAY_API_BASE') ?? '',
    appId: Deno.env.get('EBAY_APP_ID') ?? '',
    certId: Deno.env.get('EBAY_CERT_ID') ?? '',
    marketplace: Deno.env.get('EBAY_MARKETPLACE_ID') ?? 'EBAY_US',
  }
  if (!cfg.base || !cfg.appId || !cfg.certId) {
    logWarn(reqId, 'eBay not configured, skipping run')
    return new Response(JSON.stringify({ ok: true, claimed: 0, skipped: 'ebay_disabled' }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  const { data: claimed, error: claimErr } = await supabase.rpc(
    'claim_cards_for_backfill_enrichment',
    { p_limit: BATCH_SIZE, p_lease_seconds: LEASE_SECONDS }
  )
  if (claimErr) {
    logErr(reqId, 'claim rpc failed', { error: claimErr })
    return new Response(JSON.stringify({ ok: false, error: 'claim_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const cards = (claimed ?? []) as ClaimedCard[]
  logInfo(reqId, `claimed ${cards.length} card(s)`)
  const stats = { processed: 0, enriched: 0, noMatch: 0, failed: 0 }

  for (const card of cards) {
    try {
      const q = normalize(`${card.name ?? ''} ${card.set_name ?? ''}`.trim())
      if (!q) {
        logWarn(reqId, 'empty/malformed name+set, marking terminal', { id: card.id })
        await markEnriched(card.id)
        stats.noMatch++
        await sleep(THROTTLE_MS)
        continue
      }

      const { results: ebayResults, preknownHints } = await fetchFromEbay(cfg, q, EBAY_SEARCH_LIMIT)

      if (ebayResults.length) {
        const queryHash = await sha256HexStr(`${q}:{}`)
        const providerQueryKey = await sha256HexStr(`ebay:${queryHash}`)
        const cacheRes = await writeEbayProviderCache(
          supa,
          srole,
          providerQueryKey,
          ebayResults,
          EBAY_CACHE_TTL
        )
        if (!cacheRes.ok) throw new Error(`provider_search_cache write ${cacheRes.status}`)
      }

      let imageCommitted = false
      const [qHash, hint] = [...preknownHints.entries()][0] ?? []
      if (qHash && hint) {
        const hintRes = await writeImageSearchCacheHint(supa, srole, qHash, hint)
        if (!hintRes.ok) throw new Error(`image_search_cache write ${hintRes.status}`)
        const cacheCommits = await commitCacheFromQueryHash(qHash, 1, supabase)
        const commitRes: any = await commitCardImageFromCacheUpsert(
          { card_id: card.id, kind: 'front' },
          cacheCommits,
          supabase
        )
        if (commitRes?.error) {
          logWarn(reqId, 'image commit failed (non-fatal, card still marked enriched)', {
            id: card.id,
            error: String(commitRes.error),
          })
        } else {
          imageCommitted = true
        }
      }

      await markEnriched(card.id)
      stats.processed++
      ebayResults.length ? stats.enriched++ : stats.noMatch++
      logInfo(reqId, 'enriched card', {
        id: card.id,
        ebayMatches: ebayResults.length,
        imageCommitted,
      })
    } catch (err) {
      // Per-card failure: log, skip, leave enriched_at null for retry, and
      // release the lease early so a crash-mid-batch row is reclaimable
      // well before LEASE_SECONDS elapses.
      stats.failed++
      logErr(reqId, 'card enrichment failed', { id: card.id, error: String(err) })
      const { error: releaseErr } = await supabase
        .from('cards')
        .update({ enrichment_locked_at: null })
        .eq('id', card.id)
      if (releaseErr)
        logErr(reqId, 'failed to release lease', { id: card.id, error: String(releaseErr) })
    }
    await sleep(THROTTLE_MS)
  }

  return new Response(JSON.stringify({ ok: true, claimed: cards.length, ...stats }), {
    headers: { 'content-type': 'application/json' },
  })
})

async function markEnriched(cardId: string) {
  const { error } = await supabase
    .from('cards')
    .update({ enriched_at: new Date().toISOString(), enrichment_locked_at: null })
    .eq('id', cardId)
  if (error) throw error
}
