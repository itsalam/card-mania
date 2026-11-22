// Run: deno test supabase/functions/_shared/cardhedge.test.ts
// The CardHedger chokepoint (ITS-113) with an injected fetch, budget and ledger.
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import {
  BudgetExhaustedError,
  type CardHedgeCallRecord,
  cardhedgeClient,
  type CardHedgeClientOptions,
  endpointClass,
} from './cardhedge.ts'
import { RateLimitedError } from './cardhedge-prices.ts'

const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function harness(
  responses: Array<Response | Error>,
  overrides: Partial<CardHedgeClientOptions> = {}
) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const ledger: CardHedgeCallRecord[] = []
  const budget: Array<{ cls: string; n: number; scheduled: boolean }> = []
  let t = 1000
  const client = cardhedgeClient({
    apiBase: 'https://ch.test',
    apiKey: 'k',
    caller: 'test',
    fetch: (url, init) => {
      calls.push({ url: String(url), init })
      const next = responses.shift() ?? jsonResp({})
      t += 10
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
    },
    consumeBudget: (cls, n, scheduled) => {
      budget.push({ cls, n, scheduled })
      return Promise.resolve(true)
    },
    recordCall: (row) => {
      ledger.push(row)
      return Promise.resolve()
    },
    backoff: { sleep: () => Promise.resolve(), random: () => 0 },
    now: () => t,
    ...overrides,
  })
  return { client, calls, ledger, budget }
}

Deno.test('endpointClass groups endpoints into budget classes', () => {
  assertEquals(endpointClass('card-search'), 'search')
  assertEquals(endpointClass('card-match'), 'match')
  assertEquals(endpointClass('all-prices-by-card'), 'prices')
  assertEquals(endpointClass('prices-by-card'), 'prices')
  assertEquals(endpointClass('top-movers'), 'other')
})

Deno.test('a call takes one budget unit, sends the key, and is ledgered', async () => {
  const { client, calls, ledger, budget } = harness([jsonResp({ cards: [{ card_id: 'a' }] })], {
    scheduled: true,
  })
  const cards = await client.search('charizard', 500)
  assertEquals(cards.length, 1)
  assertEquals(budget, [{ cls: 'search', n: 1, scheduled: true }])
  assertEquals(calls[0].url, 'https://ch.test/v1/cards/card-search')
  assertEquals((calls[0].init?.headers as Record<string, string>)['X-API-Key'], 'k')
  assertEquals(JSON.parse(String(calls[0].init?.body)).page_size, 100)
  assertEquals(ledger.length, 1)
  assertEquals(ledger[0].caller, 'test')
  assertEquals(ledger[0].endpoint, 'card-search')
  assertEquals(ledger[0].scheduled, true)
  assertEquals(ledger[0].status, 200)
  assertEquals(ledger[0].retries, 0)
  assertEquals(ledger[0].rate_limited, false)
  assertEquals(ledger[0].error, null)
  assert((ledger[0].duration_ms ?? -1) >= 0)
})

Deno.test('a denied budget throws without calling CardHedger and is ledgered', async () => {
  const { client, calls, ledger } = harness([], {
    consumeBudget: () => Promise.resolve(false),
  })
  const err = await assertRejects(() => client.match('q'), BudgetExhaustedError)
  assertEquals(err.endpointClass, 'match')
  assertEquals(calls.length, 0)
  assertEquals(ledger.length, 1)
  assertEquals(ledger[0].budget_denied, true)
  assertEquals(ledger[0].status, null)
})

Deno.test('a budget check that errors fails open', async () => {
  const { client, calls } = harness([jsonResp({ prices: [] })], {
    consumeBudget: () => Promise.reject(new Error('db down')),
  })
  assertEquals(await client.allPrices('x'), [])
  assertEquals(calls.length, 1)
})

Deno.test('a 429 that recovers is ledgered as rate limited, with its retries', async () => {
  const { client, calls, ledger, budget } = harness([
    jsonResp({}, 429),
    jsonResp({}, 429),
    jsonResp({ prices: [{ price: '1', closing_date: '2026-01-01' }] }),
  ])
  const points = await client.history('c1', 'PSA 10', 30)
  assertEquals(points.length, 1)
  assertEquals(calls.length, 3)
  assertEquals(budget.length, 1, 'retries cost no extra budget')
  assertEquals(ledger.length, 1)
  assertEquals(ledger[0].retries, 2)
  assertEquals(ledger[0].rate_limited, true)
  assertEquals(ledger[0].status, 200)
  assertEquals(JSON.parse(String(calls[0].init?.body)), {
    card_id: 'c1',
    grade: 'PSA 10',
    days: 30,
  })
})

Deno.test('a persistent 429 throws RateLimitedError and is ledgered', async () => {
  const { client, calls, ledger } = harness([429, 429, 429, 429].map((s) => jsonResp({}, s)))
  await assertRejects(() => client.search('q', 5), RateLimitedError)
  assertEquals(calls.length, 4)
  assertEquals(ledger[0].status, 429)
  assertEquals(ledger[0].retries, 3)
  assertEquals(ledger[0].rate_limited, true)
  assert(ledger[0].error?.includes('rate limited'))
})

Deno.test(
  'a 4xx is returned to the wrapper, not retried, and ledgered with its status',
  async () => {
    const { client, calls, ledger } = harness([jsonResp({ detail: 'bad' }, 422)])
    await assertRejects(() => client.match('q'), Error, 'card-match error 422')
    assertEquals(calls.length, 1)
    assertEquals(ledger[0].status, 422)
    assertEquals(ledger[0].error, 'HTTP 422')
  }
)

Deno.test('top-movers is a GET with the count capped at 100', async () => {
  const { client, calls, ledger } = harness([jsonResp({ cards: [] })])
  await client.topMovers(500)
  assertEquals(calls[0].url, 'https://ch.test/v1/cards/top-movers?count=100')
  assertEquals(calls[0].init?.method, 'GET')
  assertEquals(calls[0].init?.body, undefined)
  assertEquals(ledger[0].endpoint_class, 'other')
})

Deno.test('a failing ledger write never fails the call', async () => {
  const { client } = harness([jsonResp({ cards: [] })], {
    recordCall: () => Promise.reject(new Error('insert failed')),
  })
  assertEquals(await client.search('q', 5), [])
})

Deno.test('with waitUntil, the ledger write is handed off instead of awaited', async () => {
  const handed: Promise<unknown>[] = []
  let resolveWrite!: () => void
  const { client } = harness([jsonResp({ cards: [] })], {
    recordCall: () => new Promise<void>((r) => (resolveWrite = r)),
    waitUntil: (p) => handed.push(p),
  })
  assertEquals(await client.search('q', 5), [])
  assertEquals(handed.length, 1)
  resolveWrite()
  await handed[0]
})

// ── Block claims (claimBlock / reserve / release) ──

function blockHarness(budgetLeft: number, overrides: Partial<CardHedgeClientOptions> = {}) {
  const claims: number[] = []
  const released: Array<{ cls: string; n: number; scheduled: boolean; day: string }> = []
  let left = budgetLeft
  const h = harness([], {
    scheduled: true,
    claimBlock: 5,
    consumeBudget: (_cls, n) => {
      claims.push(n)
      if (n > left) return Promise.resolve(false)
      left -= n
      return Promise.resolve(true)
    },
    releaseBudget: (cls, n, scheduled, day) => {
      released.push({ cls, n, scheduled, day })
      return Promise.resolve()
    },
    ...overrides,
  })
  return { ...h, claims, released }
}

Deno.test('with claimBlock, one round trip covers a block of calls', async () => {
  const { client, claims, calls, released } = blockHarness(100)
  for (let i = 0; i < 7; i++) await client.search('q', 5)
  assertEquals(calls.length, 7)
  assertEquals(claims, [5, 5], 'two block claims for seven calls')
  await client.release()
  assertEquals(released, [{ cls: 'search', n: 3, scheduled: true, day: '1970-01-01' }])
  await client.release()
  assertEquals(released.length, 1, 'units are released once')
})

Deno.test('blocks are per endpoint class', async () => {
  const { client, claims, released } = blockHarness(100)
  await client.search('q', 5)
  await client.allPrices('x')
  assertEquals(claims, [5, 5])
  await client.release()
  assertEquals(
    released.map((r) => [r.cls, r.n]),
    [
      ['search', 4],
      ['prices', 4],
    ]
  )
})

Deno.test('a refused block falls back to single units, so the tail is usable', async () => {
  const { client, claims, calls } = blockHarness(2)
  await client.search('q', 5)
  await client.search('q', 5)
  await assertRejects(() => client.search('q', 5), BudgetExhaustedError)
  assertEquals(claims, [5, 1, 5, 1, 5, 1])
  assertEquals(calls.length, 2)
})

Deno.test('concurrent requests share one block claim', async () => {
  const { client, claims, calls } = blockHarness(100)
  await Promise.all([1, 2, 3, 4].map(() => client.allPrices('x')))
  assertEquals(calls.length, 4)
  assertEquals(claims, [5])
})

Deno.test('reserve claims a known number of calls up front', async () => {
  const { client, claims, calls, released } = blockHarness(100, { claimBlock: 1 })
  assert(await client.reserve('prices', 3))
  for (let i = 0; i < 4; i++) await client.history('c', 'PSA 10')
  assertEquals(calls.length, 4)
  assertEquals(claims, [3, 1], 'three from the reservation, the fourth claims its own')
  await client.release()
  assertEquals(released, [])
})

Deno.test('a refused reserve leaves each call to claim its own unit', async () => {
  const { client, claims } = blockHarness(1, { claimBlock: 1 })
  assertEquals(await client.reserve('prices', 3), false)
  await client.history('c', 'PSA 10')
  await assertRejects(() => client.history('c', 'PSA 9'), BudgetExhaustedError)
  assertEquals(claims, [3, 1, 1])
})

Deno.test('a failing block claim fails open without pooling units', async () => {
  const { client, calls } = blockHarness(0, {
    consumeBudget: () => Promise.reject(new Error('db down')),
  })
  await client.search('q', 5)
  await client.search('q', 5)
  assertEquals(calls.length, 2)
  const { client: c2, released } = blockHarness(0, {
    consumeBudget: () => Promise.reject(new Error('db down')),
  })
  await c2.search('q', 5)
  await c2.release()
  assertEquals(released, [])
})

Deno.test('units held across UTC midnight go back to the day they were claimed on', async () => {
  let t = Date.UTC(2026, 10, 21, 23, 59)
  const { client, claims, released } = blockHarness(100, { now: () => t })
  await client.search('q', 5)
  t = Date.UTC(2026, 10, 22, 0, 1)
  await client.search('q', 5)
  assertEquals(claims, [5, 5], "yesterday's units are not spent today")
  await client.release()
  assertEquals(
    released.map((r) => [r.day, r.n]),
    [
      ['2026-11-21', 4],
      ['2026-11-22', 4],
    ]
  )
})
