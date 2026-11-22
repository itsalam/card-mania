// The one CardHedger HTTP chokepoint (ITS-113). Every CardHedger request goes through
// CardHedgeClient.request, which:
//   1. takes one call from the global daily budget (public.consume_cardhedger_budget) — denied
//      throws BudgetExhaustedError without calling CardHedger;
//   2. calls through fetchWithBackoff (3 retries on 429/5xx, RateLimitedError when 429 persists);
//   3. writes one public.cardhedger_calls row, best-effort.
// One request costs one budget unit however many retries it takes; retries are in the ledger.
//
// Budget and ledger are injected, so tests run with fakes; createCardHedgeClient wires them to a
// Supabase service client. A budget check that errors fails open (the per-run caps and backoff
// still apply) — a DB hiccup shouldn't take CardHedger down with it.
//
// Don't fetch CARDHEDGE_API_BASE anywhere else. Callers and limits: docs/api-docs/card-hedge/RATE_LIMITS.md.
import type { CardHedgeCard, CardHedgePricePoint, CardMatchResponse } from './types.ts'
import {
  type BackoffOptions,
  type CardHedgeGradePrice,
  fetchWithBackoff,
  RateLimitedError,
} from './cardhedge-prices.ts'

export type EndpointClass = 'search' | 'match' | 'prices' | 'other'

export const endpointClass = (endpoint: string): EndpointClass =>
  endpoint === 'card-search'
    ? 'search'
    : endpoint === 'card-match'
      ? 'match'
      : endpoint === 'all-prices-by-card' || endpoint === 'prices-by-card'
        ? 'prices'
        : 'other'

/** Thrown, without calling CardHedger, when today's budget for the endpoint class is spent. */
export class BudgetExhaustedError extends Error {
  constructor(readonly endpointClass: EndpointClass) {
    super(`CardHedger ${endpointClass} budget exhausted`)
    this.name = 'BudgetExhaustedError'
  }
}

export type CardHedgeCallRecord = {
  caller: string
  endpoint: string
  endpoint_class: EndpointClass
  scheduled: boolean
  status: number | null
  duration_ms: number | null
  retries: number
  rate_limited: boolean
  budget_denied: boolean
  error: string | null
}

export type CardHedgeClientOptions = {
  apiBase: string
  apiKey: string
  /** Who is calling: the edge function, optionally with a path (e.g. 'price-charting/search'). */
  caller: string
  /** Scheduled jobs may only use the budget's scheduled_share; live callers get the rest. */
  scheduled?: boolean
  consumeBudget?: (cls: EndpointClass, n: number, scheduled: boolean) => Promise<boolean>
  recordCall?: (row: CardHedgeCallRecord) => Promise<void>
  /** Lets a ledger write outlive the response (EdgeRuntime.waitUntil); awaited otherwise. */
  waitUntil?: (p: Promise<unknown>) => void
  fetch?: typeof fetch
  backoff?: BackoffOptions
  now?: () => number
}

type RequestInit = { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> }

export type CardHedgeClient = ReturnType<typeof cardhedgeClient>

/** Builds a client from injected dependencies (tests use this directly). */
export function cardhedgeClient(opts: CardHedgeClientOptions) {
  const doFetch = opts.fetch ?? fetch
  const now = opts.now ?? Date.now
  const scheduled = opts.scheduled ?? false

  const record = async (row: Omit<CardHedgeCallRecord, 'caller' | 'scheduled'>) => {
    if (!opts.recordCall) return
    const p = opts
      .recordCall({ caller: opts.caller, scheduled, ...row })
      .catch((err) => console.warn('[cardhedge] ledger write failed', String(err)))
    if (opts.waitUntil) opts.waitUntil(p)
    else await p
  }

  /** Raw request: budget → fetchWithBackoff → ledger. Non-2xx responses are returned as-is. */
  async function request(endpoint: string, init: RequestInit = {}): Promise<Response> {
    const cls = endpointClass(endpoint)
    const base = { endpoint, endpoint_class: cls }

    let allowed = true
    if (opts.consumeBudget) {
      allowed = await opts.consumeBudget(cls, 1, scheduled).catch((err) => {
        console.warn('[cardhedge] budget check failed; allowing', String(err))
        return true
      })
    }
    if (!allowed) {
      await record({
        ...base,
        status: null,
        duration_ms: null,
        retries: 0,
        rate_limited: false,
        budget_denied: true,
        error: null,
      })
      throw new BudgetExhaustedError(cls)
    }

    const url = new URL(`${opts.apiBase}/v1/cards/${endpoint}`)
    for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v)
    const method = init.method ?? (init.body === undefined ? 'GET' : 'POST')
    const headers: Record<string, string> = { 'X-API-Key': opts.apiKey }
    if (init.body !== undefined) headers['Content-Type'] = 'application/json'

    let attempts = 0
    let saw429 = false
    const started = now()
    try {
      const resp = await fetchWithBackoff(async () => {
        attempts++
        const r = await doFetch(url.toString(), {
          method,
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
        })
        if (r.status === 429) saw429 = true
        return r
      }, opts.backoff)
      await record({
        ...base,
        status: resp.status,
        duration_ms: now() - started,
        retries: Math.max(0, attempts - 1),
        rate_limited: saw429,
        budget_denied: false,
        error: resp.ok ? null : `HTTP ${resp.status}`,
      })
      return resp
    } catch (err) {
      const limited = err instanceof RateLimitedError
      await record({
        ...base,
        status: limited ? 429 : null,
        duration_ms: now() - started,
        retries: Math.max(0, attempts - 1),
        rate_limited: limited || saw429,
        budget_denied: false,
        error: String(err).slice(0, 500),
      })
      throw err
    }
  }

  async function okJson<T>(resp: Response, what: string): Promise<T> {
    if (!resp.ok) throw new Error(`CardHedge ${what} error ${resp.status}: ${await resp.text()}`)
    return (await resp.json()) as T
  }

  return {
    caller: opts.caller,
    request,

    /** POST card-search. */
    async search(query: string, limit: number): Promise<CardHedgeCard[]> {
      const resp = await request('card-search', {
        body: { search: query, page_size: Math.min(limit, 100), raw_images_only: true },
      })
      return (await okJson<{ cards?: CardHedgeCard[] }>(resp, 'API')).cards ?? []
    },

    /**
     * POST card-match (AI). Returns the best match with a confidence score; the caller applies
     * its own threshold.
     */
    async match(
      query: string,
      options?: { category?: string; maxCandidates?: number }
    ): Promise<CardMatchResponse> {
      const resp = await request('card-match', {
        body: { query, category: options?.category, max_candidates: options?.maxCandidates ?? 10 },
      })
      return okJson<CardMatchResponse>(resp, 'card-match')
    },

    /** POST all-prices-by-card: the latest price for every grade (map with mapAllPrices). */
    async allPrices(cardId: string): Promise<CardHedgeGradePrice[]> {
      const resp = await request('all-prices-by-card', { body: { card_id: cardId } })
      return (await okJson<{ prices?: CardHedgeGradePrice[] }>(resp, 'all-prices')).prices ?? []
    },

    /** POST prices-by-card: price history for one grade. */
    async history(cardId: string, grade: string, days?: number): Promise<CardHedgePricePoint[]> {
      const body: Record<string, unknown> = { card_id: cardId, grade }
      if (days) body.days = days
      const resp = await request('prices-by-card', { body })
      return (await okJson<{ prices?: CardHedgePricePoint[] }>(resp, 'history')).prices ?? []
    },

    /** GET top-movers. */
    async topMovers(count: number): Promise<CardHedgeCard[]> {
      const resp = await request('top-movers', {
        method: 'GET',
        query: { count: String(Math.min(count, 100)) },
      })
      return (await okJson<{ cards?: CardHedgeCard[] }>(resp, 'top-movers')).cards ?? []
    },
  }
}

/** The bits of a Supabase client the budget and ledger need (kept structural for tests). */
type ServiceClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>
  }
}

/**
 * A client wired to the global budget and ledger, reading CARDHEDGE_API_BASE / _KEY from the
 * environment. Returns null when CardHedger isn't configured.
 */
export function createCardHedgeClient(
  caller: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  { scheduled = false, backoff }: { scheduled?: boolean; backoff?: BackoffOptions } = {}
): CardHedgeClient | null {
  const apiBase = Deno.env.get('CARDHEDGE_API_BASE') ?? ''
  const apiKey = Deno.env.get('CARDHEDGE_API_KEY') ?? ''
  if (!apiBase || !apiKey) return null
  const db = supabase as ServiceClient
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime
  return cardhedgeClient({
    apiBase,
    apiKey,
    caller,
    scheduled,
    backoff,
    consumeBudget: async (cls, n, sched) => {
      const { data, error } = await db.rpc('consume_cardhedger_budget', {
        p_class: cls,
        p_n: n,
        p_scheduled: sched,
      })
      if (error) throw new Error(error.message)
      return data !== false
    },
    recordCall: async (row) => {
      const { error } = await db.from('cardhedger_calls').insert(row)
      if (error) throw new Error(error.message)
    },
    // Scheduled jobs await their ledger writes; live paths shouldn't wait on them.
    waitUntil: !scheduled && runtime?.waitUntil ? (p) => runtime.waitUntil(p) : undefined,
  })
}
