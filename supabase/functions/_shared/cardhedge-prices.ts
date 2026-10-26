// Pure helpers for CardHedger pricing calls: mapping all-prices-by-card responses to our
// grades_prices shape, and retry/backoff around CardHedger HTTP calls. No Deno.env / network
// at module scope so they're unit-testable (see cardhedge-prices.test.ts).
import { canonicalGradeKey } from './grade-key.ts'

/** One element of POST /v1/cards/all-prices-by-card's `prices` array. */
export type CardHedgeGradePrice = {
  card_id: string
  grade: string // "PSA 10", "BGS 9.5", "Raw"
  grader?: string
  price: string // decimal USD, e.g. "337.67"
  display_order?: string
}

const GRADE_LABEL = /^(raw|[a-z]+\s*\d+(\.\d+)?)$/i

/**
 * Maps CardHedger's latest price per grade to `{ grades_prices (cents, canonical keys),
 * latestPriceCents (Raw, else the lowest graded price), unmapped (labels we couldn't key) }`.
 * Skips non-positive / unparseable prices; the first entry per key wins, in display_order.
 */
export function mapAllPrices(prices: CardHedgeGradePrice[]) {
  const grades_prices: Record<string, number> = {}
  const unmapped: string[] = []
  const ordered = [...prices].sort(
    (a, b) => Number(a.display_order ?? Infinity) - Number(b.display_order ?? Infinity)
  )
  for (const { grade, price } of ordered) {
    const label = (grade ?? '').trim()
    if (!GRADE_LABEL.test(label)) {
      unmapped.push(label)
      continue
    }
    const cents = Math.round(parseFloat(price) * 100)
    if (!Number.isFinite(cents) || cents <= 0) continue
    const key = canonicalGradeKey(label)
    if (!(key in grades_prices)) grades_prices[key] = cents
  }
  const values = Object.values(grades_prices)
  const latestPriceCents = grades_prices.ungraded ?? (values.length ? Math.min(...values) : null)
  return { grades_prices, latestPriceCents, unmapped }
}

/** Thrown when CardHedger keeps answering 429 after every retry. */
export class RateLimitedError extends Error {
  constructor(message = 'CardHedger rate limited') {
    super(message)
    this.name = 'RateLimitedError'
  }
}

export type BackoffOptions = {
  maxRetries?: number
  baseMs?: number
  maxMs?: number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function retryAfterMs(resp: Response): number | null {
  const h = resp.headers.get('retry-after')
  if (!h) return null
  const secs = Number(h)
  if (Number.isFinite(secs)) return secs * 1000
  const date = Date.parse(h)
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now())
}

/**
 * Runs `doFetch`, retrying 429 and 5xx with exponential backoff + jitter (honouring
 * Retry-After, capped at maxMs). Other responses — ok or not — are returned for the caller to
 * handle; network errors are retried like 5xx. Throws RateLimitedError if retries run out on a
 * 429, and the last error otherwise.
 */
export async function fetchWithBackoff(
  doFetch: () => Promise<Response>,
  {
    maxRetries = 3,
    baseMs = 500,
    maxMs = 8000,
    sleep = defaultSleep,
    random = Math.random,
  }: BackoffOptions = {}
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let resp: Response | null = null
    try {
      resp = await doFetch()
    } catch (err) {
      lastError = err
    }
    if (resp && resp.status !== 429 && resp.status < 500) return resp

    if (attempt === maxRetries) {
      if (resp?.status === 429) throw new RateLimitedError()
      if (resp) return resp
      throw lastError
    }
    const backoff = Math.min(maxMs, baseMs * 2 ** attempt) * (0.5 + random() / 2)
    const wait = resp ? Math.min(maxMs, retryAfterMs(resp) ?? backoff) : backoff
    await resp?.body?.cancel()
    await sleep(wait)
  }
  throw lastError
}
