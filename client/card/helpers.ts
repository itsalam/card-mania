import { TCard } from '@/constants/types'
import { qk } from '@/lib/store/functions/helpers'
import { QueryClient } from '@tanstack/react-query'

export function patchCard(qc: QueryClient, id: string, patch: Partial<TCard>) {
  qc.setQueryData<Record<string, TCard>>(qk.card(id), (prev) => {
    const base = prev ?? {}
    const cur = base[id]
    if (!cur) return base
    return { ...base, [id]: { ...cur, ...patch } }
  })
}

export function patchUserCard(qc: QueryClient, id: string, patch: Partial<TCard>) {
  qc.setQueryData<Record<string, TCard>>([qk.userCards(), id], (prev) => {
    const base = prev ?? {}
    const cur = base[id]
    if (!cur) return base
    return { ...base, [id]: { ...cur, ...patch } }
  })
}
