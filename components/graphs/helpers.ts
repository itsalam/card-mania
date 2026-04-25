import { PointsArray } from 'victory-native'
import { DAY_MS, TIME_PERIODS_DURATION } from './constants'

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/** Interpolate between two hex colors at position t ∈ [0, 1]. */
export function interpolateHex(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from)
  const [r2, g2, b2] = hexToRgb(to)
  return rgbToHex(
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t)
  )
}

/** Spread n colors evenly across a [from, to] hex gradient. */
export function gradientColors(from: string, to: string, n: number): string[] {
  if (n <= 0) return []
  if (n === 1) return [from]
  return Array.from({ length: n }, (_, i) => interpolateHex(from, to, i / (n - 1)))
}

export function roundToNiceCents(cents: number, dir: 'round' | 'ceil' | 'floor' = 'round'): number {
  if (cents <= 0) return 0
  const d = cents / 100
  const exp = Math.floor(Math.log10(Math.max(d, 0.01)))
  const stepCents = 5 * Math.pow(10, exp - 1) * 100
  const fn = dir === 'ceil' ? Math.ceil : dir === 'floor' ? Math.floor : Math.round
  return fn(cents / stepCents) * stepCents
}

export function fmtCardValue(cents: number): string {
  const d = cents / 100
  if (d >= 100000) return `$${(d / 1000).toFixed(1)}k`
  return `$${d.toFixed(2)}`
}

export function fmtAxisValue(cents: number): string {
  const d = cents / 100
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`
  if (d >= 100) return `$${Math.round(d / 10) * 10}`
  if (d >= 10) return `$${Math.round(d)}`
  if (d >= 1) return `$${d.toFixed(1)}`
  return `$${d.toFixed(2)}`
}

export const getTimeRange = (timePeriod: string): [Date, Date] => {
  const duration = TIME_PERIODS_DURATION[timePeriod]
  const now = new Date()
  const start = new Date(new Date(now.getTime() - duration).setHours(0, 0, 0, 0))
  return [start, now]
}

// Data x values may be Unix seconds (< 1e10) or milliseconds (>= 1e10).
export function toMs(v: number): number {
  return v < 1e10 ? v * 1000 : v
}

// Accepts a raw x value in any format (ISO date string, numeric timestamp string, or number)
// and returns a millisecond timestamp.
export function xRawToMs(raw: unknown): number {
  if (typeof raw === 'number') return toMs(raw)
  if (typeof raw === 'string') {
    const n = Number(raw)
    if (isFinite(n) && n > 0) return toMs(n)
    return Date.parse(raw)
  }
  return NaN
}

export function getXTickValues(startV: number, endV: number, timePeriod: string): number[] {
  const isSeconds = startV < 1e10
  const startMs = toMs(startV)
  const endMs = toMs(endV)
  const range = endMs - startMs
  const ticks: number[] = []
  const push = (ms: number) => ticks.push(isSeconds ? ms / 1000 : ms)

  if (timePeriod === '1W' || range <= 8 * DAY_MS) {
    let t = new Date(startMs + DAY_MS)
    t.setHours(0, 0, 0, 0)
    while (t.getTime() < endMs) {
      push(t.getTime())
      t = new Date(t.getTime() + DAY_MS)
    }
  } else if (timePeriod === '1M' || range <= 32 * DAY_MS) {
    let t = new Date(startMs)
    t.setHours(0, 0, 0, 0)
    const toMonday = (t.getDay() + 6) % 7
    t = new Date(t.getTime() + (7 - toMonday) * DAY_MS)
    t.setHours(0, 0, 0, 0)
    while (t.getTime() < endMs) {
      push(t.getTime())
      t = new Date(t.getTime() + 7 * DAY_MS)
    }
  } else {
    let t = new Date(startMs)
    t = new Date(t.getFullYear(), t.getMonth() + 1, 1)
    while (t.getTime() < endMs) {
      push(t.getTime())
      t = new Date(t.getFullYear(), t.getMonth() + 1, 1)
    }
    if (ticks.length > 8) return ticks.filter((_, i) => i % 2 === 0)
  }
  return ticks
}

export function formatXTick(v: string | number, timePeriod: string): string {
  const ms = toMs(Number(v))
  if (!ms) return ''
  const d = new Date(ms)
  if (timePeriod === '1W') return d.toLocaleDateString('en-US', { weekday: 'short' })
  if (timePeriod === '1M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short' })
}

// Module-level worklet so the Reanimated Babel plugin compiles it correctly.
export function parseXValue(raw: unknown): number {
  'worklet'
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const d = Date.parse(raw as string)
    if (!Number.isNaN(d)) return d
    const n = Number(raw)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

// O(log n) nearest-point lookup — points are sorted by x (ascending from Victory Native).
export function findNearest(
  pts: PointsArray,
  targetX: number,
  requireValue = false
): PointsArray[number] | undefined {
  const candidates = requireValue ? pts.filter((p) => p.y != null) : pts
  if (!candidates.length) return undefined
  let lo = 0
  let hi = candidates.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((candidates[mid].x ?? 0) < targetX) lo = mid + 1
    else hi = mid
  }
  if (
    lo > 0 &&
    Math.abs((candidates[lo - 1].x ?? 0) - targetX) < Math.abs((candidates[lo].x ?? 0) - targetX)
  ) {
    return candidates[lo - 1]
  }
  return candidates[lo]
}
