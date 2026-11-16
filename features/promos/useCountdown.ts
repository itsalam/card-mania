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

/** Live countdown, re-rendered every 30s. When it reaches zero, promos are refetched so a
 *  coming-soon box switches to its cards without a pull-to-refresh. */
export function useCountdown(iso: string | null): string | null {
  const qc = useQueryClient()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!iso) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [iso])

  const label = formatCountdown(iso, now)
  const released = Boolean(iso) && label === null

  useEffect(() => {
    if (released)
      qc.invalidateQueries({ queryKey: [process.env.EXPO_PUBLIC_SUPABASE_URL, 'promos'] })
  }, [released, qc])

  return label
}
