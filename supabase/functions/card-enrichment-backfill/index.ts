// ITS-40 Phase 2: card-enrichment-backfill (multi-vendor)
//
// Scheduled job (see 20260921000001_its40_card_enrichment_backfill_cron.sql):
// claims a lease-protected batch of public.cards rows where enriched_at is
// null, builds a query from name + set_name, and cascades through the same
// three vendors the live price-charting blend uses — CardHedge (priority 1),
// PriceCharting (priority 2), eBay (priority 3) — stopping at the first
// vendor that returns results. Reuses each vendor's shared fetch/cache
// helpers (@vendor-cardhedge-search, @pricecharting-search, @ebay-search) so
// nothing new is added to the cache layer. A single vendor's fetch throwing
// is treated as a miss for that vendor and the cascade continues, matching
// how the live path already treats vendor fetch failures; only a failure in
// the winning vendor's downstream cache/image write is fatal to the card.
// Marks enriched_at on a terminal outcome (a vendor hit, or every configured
// vendor tried with no results / malformed name); transient failures are
// logged and left unmarked so a later run retries them.
import type { CardHedgeConfig } from '@vendor-cardhedge-search'
import { fetchFromCardHedge, writeCardHedgeProviderCache } from '@vendor-cardhedge-search'
import {
  EbayConfig,
  fetchFromEbay,
  writeEbayProviderCache,
  writeImageSearchCacheHint,
} from '@ebay-search'
import type { PriceChartingConfig } from '@pricecharting-search'
import { fetchFromPriceCharting, writePriceChartingProviderCache } from '@pricecharting-search'
import { SearchResultItem } from '@types'
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
const CARDHEDGE_SEARCH_LIMIT = Number(Deno.env.get('ENRICHMENT_CARDHEDGE_LIMIT') ?? '5')
const CARDHEDGE_CACHE_TTL = Number(Deno.env.get('CARDHEDGE_CACHE_TTL') ?? '300')
const PRICECHARTING_SEARCH_LIMIT = Number(Deno.env.get('ENRICHMENT_PRICECHARTING_LIMIT') ?? '5')
const PRICECHARTING_CACHE_TTL = Number(Deno.env.get('PRICECHARTING_CACHE_TTL') ?? '300')

const supabase = createSupabaseServiceClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type ClaimedCard = { id: string; name: string; set_name: string }
type VendorHit = 'cardhedge' | 'pricecharting' | 'ebay' | null

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

  const ebayCfg: EbayConfig = {
    base: Deno.env.get('EBAY_API_BASE') ?? '',
    appId: Deno.env.get('EBAY_APP_ID') ?? '',
    certId: Deno.env.get('EBAY_CERT_ID') ?? '',
    marketplace: Deno.env.get('EBAY_MARKETPLACE_ID') ?? 'EBAY_US',
  }
  const ebayEnabled = Boolean(ebayCfg.base && ebayCfg.appId && ebayCfg.certId)

  const cardhedgeCfg: CardHedgeConfig = {
    apiBase: Deno.env.get('CARDHEDGE_API_BASE') ?? '',
    apiKey: Deno.env.get('CARDHEDGE_API_KEY') ?? '',
  }
  const cardhedgeEnabled = Boolean(cardhedgeCfg.apiBase && cardhedgeCfg.apiKey)

  const pcCfg: PriceChartingConfig = {
    apiBase: Deno.env.get('PRICECHARTING_API_BASE') ?? '',
    apiKey: Deno.env.get('PRICECHARTING_API_KEY') ?? '',
  }
  const pricechartingEnabled = Boolean(pcCfg.apiBase && pcCfg.apiKey)

  if (!cardhedgeEnabled && !pricechartingEnabled && !ebayEnabled) {
    logWarn(reqId, 'no vendors configured, skipping run')
    return new Response(
      JSON.stringify({ ok: true, claimed: 0, skipped: 'no_vendors_configured' }),
      { headers: { 'content-type': 'application/json' } }
    )
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

      const queryHash = await sha256HexStr(`${q}:{}`)
      const attempted: string[] = []
      let hitVendor: VendorHit = null
      let results: SearchResultItem[] = []
      let preknownHints: Map<string, { url: string; norm: string }> = new Map()
      let pcRaw: any

      if (cardhedgeEnabled) {
        attempted.push('cardhedge')
        try {
          const r = await fetchFromCardHedge(cardhedgeCfg, q, CARDHEDGE_SEARCH_LIMIT)
          if (r.results.length) {
            results = r.results
            preknownHints = r.preknownHints
            hitVendor = 'cardhedge'
          }
        } catch (err) {
          logWarn(reqId, 'CardHedge fetch failed, continuing cascade', {
            id: card.id,
            error: String(err),
          })
        }
      }

      if (!hitVendor && pricechartingEnabled) {
        attempted.push('pricecharting')
        try {
          const r = await fetchFromPriceCharting(
            pcCfg,
            undefined,
            q,
            String(PRICECHARTING_SEARCH_LIMIT)
          )
          if (r.vendorResults.length) {
            results = r.vendorResults
            pcRaw = r.raw
            hitVendor = 'pricecharting'
          }
        } catch (err) {
          logWarn(reqId, 'PriceCharting fetch failed, continuing cascade', {
            id: card.id,
            error: String(err),
          })
        }
      }

      if (!hitVendor && ebayEnabled) {
        attempted.push('ebay')
        try {
          const r = await fetchFromEbay(ebayCfg, q, EBAY_SEARCH_LIMIT)
          if (r.results.length) {
            results = r.results
            preknownHints = r.preknownHints
            hitVendor = 'ebay'
          }
        } catch (err) {
          logWarn(reqId, 'eBay fetch failed, continuing cascade', {
            id: card.id,
            error: String(err),
          })
        }
      }

      if (hitVendor === 'cardhedge') {
        const providerQueryKey = await sha256HexStr(`cardhedge:${queryHash}`)
        const cacheRes = await writeCardHedgeProviderCache(
          supa,
          srole,
          providerQueryKey,
          results,
          CARDHEDGE_CACHE_TTL
        )
        if (!cacheRes.ok)
          throw new Error(`provider_search_cache write (cardhedge) ${cacheRes.status}`)
      } else if (hitVendor === 'pricecharting') {
        const providerQueryKey = await sha256HexStr(`pricecharting:${queryHash}`)
        const cacheRes = await writePriceChartingProviderCache(
          supa,
          srole,
          providerQueryKey,
          pcRaw,
          results,
          PRICECHARTING_CACHE_TTL
        )
        if (!cacheRes.ok)
          throw new Error(`provider_search_cache write (pricecharting) ${cacheRes.status}`)
      } else if (hitVendor === 'ebay') {
        const providerQueryKey = await sha256HexStr(`ebay:${queryHash}`)
        const cacheRes = await writeEbayProviderCache(
          supa,
          srole,
          providerQueryKey,
          results,
          EBAY_CACHE_TTL
        )
        if (!cacheRes.ok) throw new Error(`provider_search_cache write (ebay) ${cacheRes.status}`)
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
      hitVendor ? stats.enriched++ : stats.noMatch++
      logInfo(reqId, 'enriched card', {
        id: card.id,
        vendorsAttempted: attempted,
        vendorHit: hitVendor,
        resultCount: results.length,
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
