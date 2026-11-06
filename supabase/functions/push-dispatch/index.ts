// push-dispatch — delivers queued push notifications through the Expo Push API (ITS-61).
//
// Invoked by pg_cron every minute and by a statement trigger on push_outbox right after new
// rows land (20261106000000_push_notifications.sql), both with the Vault edge_token. Each run:
//   1. claim_push_outbox → rows + their users' device tokens (users with no device are closed
//      out as 'no_tokens' inside the claim);
//   2. send in chunks of 100; fold tickets back per row (sent if any device accepted);
//   3. complete_push_outbox → statuses, ticket ids, prune DeviceNotRegistered tokens;
//   4. claim_push_receipts → check Expo receipts for rows sent ~15 min ago and prune tokens
//      that turned out to be dead.
// An Expo HTTP error hands the chunk's rows back as 'pending' (claim retries up to 3 times).
//
// EXPO_ACCESS_TOKEN (optional edge secret) is required only if "Enhanced push security" is
// enabled for the Expo project.
import {
  buildMessages,
  chunk,
  deadTokensFromReceipts,
  getReceipts,
  interpretTickets,
  OutboxRow,
  RECEIPT_CHUNK,
  RowResult,
  SEND_CHUNK,
  sendChunk,
} from '@expo-push'
import { isServiceRequest } from '@service-auth'
import { createSupabaseServiceClient, logEvent, rid } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const CLAIM_LIMIT = Number(Deno.env.get('PUSH_CLAIM_LIMIT') ?? '200')
const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || undefined

const supabase = createSupabaseServiceClient()
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  const reqId = rid()
  if (!isServiceRequest(req)) return json({ error: 'Unauthorized' }, 401)

  try {
    const sent = await dispatch(reqId)
    const receipts = await checkReceipts(reqId)
    return json({ ok: true, ...sent, ...receipts })
  } catch (e) {
    logEvent('error', reqId, 'push.dispatch_failed', { error: String(e) })
    return json({ ok: false, error: String(e) }, 500)
  }
})

async function dispatch(reqId: string) {
  const { data, error } = await supabase.rpc('claim_push_outbox', { p_limit: CLAIM_LIMIT })
  if (error) throw error
  const rows = (data ?? []) as OutboxRow[]
  if (rows.length === 0) return { claimed: 0 }

  const results: RowResult[] = []
  const deadTokens: string[] = []

  for (const batch of chunk(buildMessages(rows), SEND_CHUNK)) {
    try {
      const tickets = await sendChunk(
        batch.map((b) => b.message),
        { accessToken }
      )
      const folded = interpretTickets(batch, tickets)
      results.push(...folded.results)
      deadTokens.push(...folded.deadTokens)
    } catch (e) {
      logEvent('warn', reqId, 'push.send_chunk_failed', { error: String(e), size: batch.length })
      for (const id of new Set(batch.map((b) => b.outboxId))) {
        results.push({ id, status: 'pending', reason: 'expo_http_error', tickets: [] })
      }
    }
  }

  const merged = mergeSplitRows(results)
  const { error: completeError } = await supabase.rpc('complete_push_outbox', {
    p_results: merged,
    p_dead_tokens: deadTokens,
  })
  if (completeError) throw completeError

  const summary = {
    claimed: rows.length,
    sent: merged.filter((r) => r.status === 'sent').length,
    failed: merged.filter((r) => r.status === 'failed').length,
    retry: merged.filter((r) => r.status === 'pending').length,
    dead_tokens: deadTokens.length,
  }
  logEvent('info', reqId, 'push.dispatched', summary)
  return summary
}

// A row with many devices can straddle two chunks; combine its partial results (sent wins,
// then pending/retry, then failed).
function mergeSplitRows(results: RowResult[]): RowResult[] {
  const rank = { sent: 2, pending: 1, failed: 0 } as const
  const byId = new Map<number, RowResult>()
  for (const r of results) {
    const prev = byId.get(r.id)
    if (!prev) {
      byId.set(r.id, { ...r, tickets: [...r.tickets] })
      continue
    }
    prev.tickets.push(...r.tickets)
    if (rank[r.status] > rank[prev.status]) {
      prev.status = r.status
      prev.reason = r.reason
    }
    if (prev.status === 'sent') delete prev.reason
  }
  return [...byId.values()]
}

async function checkReceipts(reqId: string) {
  const { data, error } = await supabase.rpc('claim_push_receipts', { p_limit: 300 })
  if (error) throw error
  const rows = (data ?? []) as {
    outbox_id: number
    tickets: { token: string; ticket_id: string }[]
  }[]
  const tickets = rows.flatMap((r) => r.tickets ?? [])
  if (tickets.length === 0) return { receipts_checked: 0 }

  const dead: string[] = []
  for (const ids of chunk(
    tickets.map((t) => t.ticket_id),
    RECEIPT_CHUNK
  )) {
    try {
      const receipts = await getReceipts(ids, { accessToken })
      dead.push(...deadTokensFromReceipts(tickets, receipts))
    } catch (e) {
      logEvent('warn', reqId, 'push.receipts_failed', { error: String(e) })
    }
  }
  if (dead.length > 0) {
    const { error: delError } = await supabase.rpc('complete_push_outbox', {
      p_results: [],
      p_dead_tokens: [...new Set(dead)],
    })
    if (delError) throw delError
  }
  logEvent('info', reqId, 'push.receipts_checked', { tickets: tickets.length, dead: dead.length })
  return { receipts_checked: tickets.length, receipt_dead_tokens: dead.length }
}
