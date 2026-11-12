// Pure time math for hours tracking: activity events -> work sessions -> hours per day.

import { addDays, dayKey, parseDay } from './lib.mjs'

const MIN = 60_000

/**
 * Groups timestamped activity events into work sessions. A session ends when the gap to the
 * next event exceeds idleGapMin. Each session is credited a lead-in before its first event.
 * @param {{ t: number, src: string }[]} events
 * @returns {{ start: number, end: number, sources: string[] }[]}
 */
export function buildSessions(events, { idleGapMin, leadInMin, gitOnlyLeadInMin }) {
  const sorted = [...events].sort((a, b) => a.t - b.t)
  const groups = []
  let current = null
  for (const e of sorted) {
    if (current && e.t - current.last <= idleGapMin * MIN) {
      current.last = e.t
      current.sources.add(e.src)
      continue
    }
    current = { first: e.t, last: e.t, sources: new Set([e.src]) }
    groups.push(current)
  }
  return groups.map((g) => {
    const gitOnly = g.sources.size === 1 && g.sources.has('git')
    const leadIn = (gitOnly ? gitOnlyLeadInMin : leadInMin) * MIN
    return { start: g.first - leadIn, end: g.last, sources: [...g.sources] }
  })
}

/** Unions overlapping [start, end] intervals so overlapping sources aren't double counted. */
export function mergeIntervals(intervals) {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start)
  const out = []
  for (const { start, end } of sorted) {
    const last = out.at(-1)
    if (last && start <= last.end) last.end = Math.max(last.end, end)
    else out.push({ start, end })
  }
  return out
}

/** Splits intervals at local midnight and sums minutes per day key. */
export function minutesByDay(intervals) {
  const out = new Map()
  for (const { start, end } of intervals) {
    let cursor = start
    while (cursor < end) {
      const key = dayKey(new Date(cursor))
      const nextMidnight = parseDay(addDays(key, 1)).getTime()
      const segEnd = Math.min(end, nextMidnight)
      out.set(key, (out.get(key) ?? 0) + (segEnd - cursor) / MIN)
      cursor = segEnd
    }
  }
  return out
}

/**
 * Applies manual ledger entries on top of tracked minutes.
 * `set` replaces the tracked hours for a day (last one wins); `add` is added on top either way.
 * @returns {Map<string, { tracked: number, adjust: number, override: number | null, total: number }>}
 */
export function applyLedger(trackedMinutes, ledger) {
  const days = new Map()
  const day = (key) => {
    if (!days.has(key)) {
      const tracked = (trackedMinutes.get(key) ?? 0) / 60
      days.set(key, { tracked, adjust: 0, override: null, total: 0 })
    }
    return days.get(key)
  }
  for (const key of trackedMinutes.keys()) day(key)
  for (const entry of ledger) {
    if (entry.type === 'add') day(entry.date).adjust += entry.hours
    if (entry.type === 'set') day(entry.date).override = entry.hours
  }
  for (const d of days.values()) d.total = Math.max(0, (d.override ?? d.tracked) + d.adjust)
  return days
}
