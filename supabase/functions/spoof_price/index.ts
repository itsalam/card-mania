// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

type RequestBody = {
  seed?: number
  initial_price?: number
  variance?: number
  date_span?: number
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

// Mulberry32 PRNG for deterministic noise based on a numeric seed.
function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t |= 0
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const DEFAULTS = {
  seed: 0,
  initialPrice: 10,
  variance: 0.05, // 5% swings
  dateSpan: 30,
}

function bucketSizeForSpan(span: number) {
  if (span <= 31) return 1 // daily
  if (span <= 90) return 3 // every ~3 days
  if (span <= 180) return 7 // weekly-ish
  return 30 // roughly monthly for long spans
}

// Generate a backward random walk so the most recent price (today) is exactly finalTarget
function generateBaseSeries(seed: number, finalTarget: number, variance: number, days = 365) {
  const rand = mulberry32(seed)
  const prices = [finalTarget] // start at "today"

  // Walk backward in time: derive previous price from current by undoing a drift.
  for (let i = 1; i <= days; i++) {
    const drift = (rand() - 0.5) * 2 * variance // -variance..+variance
    const prev = Math.max(0.01, prices[i - 1] / (1 + drift))
    prices.push(Number(prev.toFixed(2)))
  }

  // Reverse so index 0 = oldest date, last index = today (finalTarget)
  return prices.reverse()
}

function getBucketedSeries(base: number[], spanDays: number) {
  const bucket = bucketSizeForSpan(spanDays)
  const points: { day: string; price: number }[] = []
  const today = new Date()

  for (let d = 0; d < spanDays; d += bucket) {
    const idx = Math.min(d, base.length - 1)
    const date = new Date(today)
    date.setDate(today.getDate() - (spanDays - 1 - d))
    points.push({ day: date.toISOString().slice(0, 10), price: base[idx] })
  }

  return { bucketDays: bucket, points }
}

Deno.serve(async (req) => {
  try {
    const body = (await req.json()) as RequestBody
    const initialPrice = body.initial_price ?? DEFAULTS.initialPrice
    const variance = body.variance ?? DEFAULTS.variance
    const dateSpan = clamp(body.date_span ?? DEFAULTS.dateSpan, 1, 365)

    // Seed includes provided seed + params so same inputs always yield the same series.
    const baseSeed =
      Math.floor((body.seed ?? DEFAULTS.seed) + initialPrice * 100 + variance * 10_000) >>> 0

    const baseSeries = generateBaseSeries(baseSeed, initialPrice, variance, 365)
    const bucketed = getBucketedSeries(baseSeries, dateSpan)

    return new Response(
      JSON.stringify({
        seed_used: baseSeed,
        initial_price: initialPrice,
        variance,
        date_span: dateSpan,
        bucket_days: bucketed.bucketDays,
        prices: bucketed.points,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('spoof_price error', err)
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
  }
})
