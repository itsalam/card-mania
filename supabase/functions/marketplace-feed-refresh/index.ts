// marketplace-feed-refresh — populates custom (data-defined) marketplace sections (ITS-97).
//
// Scheduled every 5 minutes by 20261104000001_its97_custom_marketplace_feeds.sql. For each
// custom marketplace_section_meta row whose own refresh_interval has elapsed
// (due_marketplace_feeds), computes the feed from its declarative `filter` + `order_by`
// (marketplace_feed_listings — allowlisted criteria, parameterized SQL) and replaces the
// section's cached rows (write_marketplace_section). get_marketplace_sections() then serves it
// alongside the built-in sections with no client change.
//
// On demand: POST { "keys": ["shohei_ohtani"], "force": true } refreshes specific sections
// regardless of expiry (e.g. right after inserting a new feed). Service key only.
//
// One section failing (bad filter, query error) doesn't stop the others; it's reported in the
// response and logs, and retried on the next tick since its expiry wasn't advanced.
import { isServiceRequest } from '@service-auth'
import { createSupabaseServiceClient, logEvent, rid } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const supabase = createSupabaseServiceClient()
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

type DueFeed = {
  key: string
  filter: Record<string, unknown>
  order_by: string
  result_limit: number
}

Deno.serve(async (req) => {
  const reqId = rid()
  if (!isServiceRequest(req)) return json({ error: 'Unauthorized' }, 401)

  let keys: string[] | null = null
  let force = false
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    if (Array.isArray(body?.keys)) keys = body.keys.filter((k: unknown) => typeof k === 'string')
    force = body?.force === true
  }

  const { data: due, error } = await supabase.rpc('due_marketplace_feeds', {
    p_keys: keys ?? undefined,
    p_force: force,
  })
  if (error) {
    logEvent('error', reqId, 'feed_refresh.due_failed', { error: error.message })
    return json({ ok: false, error: error.message }, 500)
  }

  const results: { key: string; items?: number; error?: string }[] = []
  for (const feed of (due ?? []) as DueFeed[]) {
    try {
      const { data: rows, error: queryError } = await supabase.rpc('marketplace_feed_listings', {
        p_filter: feed.filter,
        p_order_by: feed.order_by,
        p_limit: feed.result_limit,
      })
      if (queryError) throw queryError
      const { data: written, error: writeError } = await supabase.rpc('write_marketplace_section', {
        p_key: feed.key,
        p_rows: rows ?? [],
      })
      if (writeError) throw writeError
      results.push({ key: feed.key, items: written ?? 0 })
    } catch (e) {
      const message = (e as { message?: string })?.message ?? String(e)
      logEvent('warn', reqId, 'feed_refresh.section_failed', { key: feed.key, error: message })
      results.push({ key: feed.key, error: message })
    }
  }

  logEvent('info', reqId, 'feed_refresh.done', {
    refreshed: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
  })
  return json({ ok: true, results })
})
