import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

/** "3d 4h", "5h 12m", "12m" until `iso`, or null once it has passed (or when there is none). */
export function formatCountdown(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now
  if (!(ms > 0)) return null
  const mins = Math.floor(ms / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(m, 1)}m`
}

/** Days / hours / minutes until `iso`, or null once it has passed (or when there is none). */
export type CountdownParts = { days: number; hours: number; mins: number }

export function countdownParts(iso: string | null, now = Date.now()): CountdownParts | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now
  if (!(ms > 0)) return null
  const total = Math.max(1, Math.floor(ms / 60000))
  return {
    days: Math.floor(total / 1440),
    hours: Math.floor((total % 1440) / 60),
    mins: total % 60,
  }
}

/** Re-renders every 30s until `iso`. When it passes, promos are refetched so a coming-soon box
 *  switches to its cards without a pull-to-refresh. */
function useReleaseClock(iso: string | null): number {
  const qc = useQueryClient()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!iso) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [iso])

  const released = Boolean(iso) && formatCountdown(iso, now) === null

  useEffect(() => {
    if (released)
      qc.invalidateQueries({ queryKey: [process.env.EXPO_PUBLIC_SUPABASE_URL, 'promos'] })
  }, [released, qc])

  return now
}

/** Live countdown label ("3d 4h"), or null once released. */
export function useCountdown(iso: string | null): string | null {
  return formatCountdown(iso, useReleaseClock(iso))
}

/** Live countdown split into days / hours / minutes, or null once released. */
export function useCountdownParts(iso: string | null): CountdownParts | null {
  return countdownParts(iso, useReleaseClock(iso))
}
