// Run: deno test supabase/functions/_shared/cardhedge-prices.test.ts
import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { fetchWithBackoff, mapAllPrices, RateLimitedError } from './cardhedge-prices.ts'

const p = (grade: string, price: string, display_order?: string) => ({
  card_id: 'ch1',
  grade,
  price,
  display_order,
})

Deno.test('mapAllPrices maps labels to canonical keys in cents', () => {
  const { grades_prices, latestPriceCents, unmapped } = mapAllPrices([
    p('PSA 10', '337.67'),
    p('BGS 9.5', '120'),
    p('Raw', '12.345'),
  ])
  assertEquals(grades_prices, { psa10: 33767, bgs9_5: 12000, ungraded: 1235 })
  assertEquals(latestPriceCents, 1235)
  assertEquals(unmapped, [])
})

Deno.test('mapAllPrices skips bad prices, records unmapped labels, falls back to min', () => {
  const { grades_prices, latestPriceCents, unmapped } = mapAllPrices([
    p('PSA 9', '0'),
    p('PSA 8', 'n/a'),
    p('PSA 10', '50'),
    p('CGC 9', '40'),
    p('Authentic Altered', '10'),
  ])
  assertEquals(grades_prices, { psa10: 5000, cgc9: 4000 })
  assertEquals(latestPriceCents, 4000)
  assertEquals(unmapped, ['Authentic Altered'])
})

Deno.test('mapAllPrices keeps the first entry per key by display_order', () => {
  const { grades_prices } = mapAllPrices([p('PSA 10', '99', '2'), p('psa 10', '50', '1')])
  assertEquals(grades_prices, { psa10: 5000 })
})

const noSleep = () => Promise.resolve()
const responses = (...statuses: (number | [number, Record<string, string>])[]) => {
  let i = 0
  const calls: number[] = []
  const doFetch = () => {
    const s = statuses[Math.min(i++, statuses.length - 1)]
    const [status, headers] = Array.isArray(s) ? s : [s, {}]
    calls.push(status)
    return Promise.resolve(new Response(status === 200 ? '{}' : 'err', { status, headers }))
  }
  return { doFetch, calls }
}

Deno.test('fetchWithBackoff retries a 429 then succeeds, honouring Retry-After', async () => {
  const waits: number[] = []
  const { doFetch, calls } = responses([429, { 'retry-after': '2' }], 200)
  const resp = await fetchWithBackoff(doFetch, {
    sleep: (ms) => (waits.push(ms), Promise.resolve()),
  })
  assertEquals(resp.status, 200)
  assertEquals(calls, [429, 200])
  assertEquals(waits, [2000])
})

Deno.test('fetchWithBackoff throws RateLimitedError after repeated 429s', async () => {
  const { doFetch, calls } = responses(429, 429, 429, 429)
  await assertRejects(
    () => fetchWithBackoff(doFetch, { maxRetries: 3, sleep: noSleep }),
    RateLimitedError
  )
  assertEquals(calls.length, 4)
})

Deno.test('fetchWithBackoff retries 5xx and returns the final response', async () => {
  const { doFetch, calls } = responses(500, 503, 200)
  const resp = await fetchWithBackoff(doFetch, { sleep: noSleep })
  assertEquals(resp.status, 200)
  assertEquals(calls, [500, 503, 200])
})

Deno.test('fetchWithBackoff does not retry other 4xx', async () => {
  const { doFetch, calls } = responses(400, 200)
  const resp = await fetchWithBackoff(doFetch, { sleep: noSleep })
  assertEquals(resp.status, 400)
  assertEquals(calls, [400])
})

Deno.test('fetchWithBackoff caps the wait at maxMs', async () => {
  const waits: number[] = []
  const { doFetch } = responses([429, { 'retry-after': '120' }], 200)
  await fetchWithBackoff(doFetch, {
    maxMs: 8000,
    sleep: (ms) => (waits.push(ms), Promise.resolve()),
  })
  assertEquals(waits, [8000])
})
