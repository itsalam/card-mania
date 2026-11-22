// The one CardHedger HTTP chokepoint (ITS-113). Every CardHedger request goes through
// CardHedgeClient.request, which:
//   1. takes one call from the global daily budget (public.consume_cardhedger_budget) — denied
//      throws BudgetExhaustedError without calling CardHedger. With claimBlock > 1 (scheduled
//      jobs) units are claimed in blocks and spent locally, so most calls skip the round trip;
//      reserve(cls, n) claims a known number up front. release() hands unspent units back
//      (public.release_cardhedger_budget) and must run before the client is dropped;
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
  /** Gives unspent claimed units back to the given UTC day's budget. */
  releaseBudget?: (cls: EndpointClass, n: number, scheduled: boolean, day: string) => Promise<void>
  /**
   * Units claimed per budget round trip (default 1). A denied block falls back to a single
   * unit, so the tail of a budget is still usable. Call release() when done.
   */
  claimBlock?: number
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
  const block = Math.max(1, Math.floor(opts.claimBlock ?? 1))
  const utcDay = () => new Date(now()).toISOString().slice(0, 10)

  // Claimed-but-unspent units per class, tagged with the UTC day they were counted against.
  const pool = new Map<EndpointClass, { n: number; day: string }>()
  // Claims for a class run one at a time, so concurrent requests share a block instead of
  // each claiming their own.
  const locks = new Map<EndpointClass, Promise<unknown>>()
  function withLock<T>(cls: EndpointClass, fn: () => Promise<T>): Promise<T> {
    const next = (locks.get(cls) ?? Promise.resolve()).then(fn, fn)
    locks.set(
      cls,
      next.catch(() => {})
    )
    return next
  }

  /** true/false from the budget; null when the check itself failed (callers fail open). */
  async function claim(cls: EndpointClass, n: number): Promise<boolean | null> {
    try {
      return await opts.consumeBudget!(cls, n, scheduled)
    } catch (err) {
      console.warn('[cardhedge] budget check failed; allowing', String(err))
      return null
    }
  }

  function addToPool(cls: EndpointClass, n: number, day: string) {
    const held = pool.get(cls)
    if (held && held.day === day) held.n += n
    else {
      if (held?.n) void giveBack(cls, held)
      pool.set(cls, { n, day })
    }
  }

  function giveBack(cls: EndpointClass, held: { n: number; day: string }): Promise<void> {
    if (!opts.releaseBudget || held.n < 1) return Promise.resolve()
    const p = opts
      .releaseBudget(cls, held.n, scheduled, held.day)
      .catch((err) => console.warn('[cardhedge] budget release failed', String(err)))
    if (opts.waitUntil) opts.waitUntil(p)
    return p
  }

  /** One unit for one request: from the pool, else a block claim, else a single unit. */
  const take = (cls: EndpointClass): Promise<boolean> =>
    withLock(cls, async () => {
      const day = utcDay()
      const held = pool.get(cls)
      if (held && held.day === day && held.n > 0) {
        held.n--
        return true
      }
      if (block > 1) {
        const ok = await claim(cls, block)
        if (ok === null) return true
        if (ok) {
          addToPool(cls, block - 1, day)
          return true
        }
      }
      return (await claim(cls, 1)) ?? true
    })

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

    const allowed = opts.consumeBudget ? await take(cls) : true
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

    /**
     * Claims n units of cls up front for calls about to be made (e.g. one per grade). false
     * when the budget can't cover all n; the calls then claim one at a time as usual.
     */
    reserve(cls: EndpointClass, n: number): Promise<boolean> {
      if (!opts.consumeBudget || n < 1) return Promise.resolve(true)
      return withLock(cls, async () => {
        const day = utcDay()
        const ok = await claim(cls, n)
        if (ok) addToPool(cls, n, day)
        return ok === true
      })
    },

    /** Gives every unspent claimed unit back. Awaited unless waitUntil is set. */
    async release(): Promise<void> {
      const held = [...pool]
      pool.clear()
      const all = Promise.all(held.map(([cls, h]) => giveBack(cls, h)))
      if (!opts.waitUntil) await all
    },

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
  {
    scheduled = false,
    backoff,
    claimBlock,
  }: { scheduled?: boolean; backoff?: BackoffOptions; claimBlock?: number } = {}
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
    claimBlock,
    consumeBudget: async (cls, n, sched) => {
      const { data, error } = await db.rpc('consume_cardhedger_budget', {
        p_class: cls,
        p_n: n,
        p_scheduled: sched,
      })
      if (error) throw new Error(error.message)
      return data !== false
    },
    releaseBudget: async (cls, n, sched, day) => {
      const { error } = await db.rpc('release_cardhedger_budget', {
        p_class: cls,
        p_n: n,
        p_scheduled: sched,
        p_day: day,
      })
      if (error) throw new Error(error.message)
    },
    recordCall: async (row) => {
      const { error } = await db.from('cardhedger_calls').insert(row)
      if (error) throw new Error(error.message)
    },
    // Scheduled jobs await their ledger writes; live paths shouldn't wait on them.
    waitUntil: !scheduled && runtime?.waitUntil ? (p) => runtime.waitUntil(p) : undefined,
  })
}
