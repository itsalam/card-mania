import { ItemKinds } from '@/constants/types'
import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ViewParams } from './types'

export function useListingsForUser(opts?: {
  userId?: string
  pageSize?: number
  search?: string // e.g. filter by card title (requires a title column in cards)
  kind?: ItemKinds
}) {
  const pageSize = opts?.pageSize ?? 50
  const search = opts?.search?.trim() || ''
  const kind = opts?.kind ?? 'card'
  const userId = opts?.userId

  const queryKey = [
    ...qk.userCards(userId ?? 'me'),
    {
      search,
      pageSize,
    },
    kind,
  ]

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null, // cursor = created_at (ISO string)
    queryFn: async ({ pageParam }) => {
      let qb = getSupabase()
        .from('wishlist_cards_enriched')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(pageSize)

      if (pageParam) qb = qb.lt('created_at', pageParam)
      if (search) qb = qb.ilike('title', `%${search}%`) // adjust column name(s) to your schema

      const { data, error } = await qb
      if (error) throw error
      return data
    },
    getNextPageParam: (lastPage) =>
      lastPage?.length ? lastPage[lastPage.length - 1].created_at : null,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  return { query, viewParams: { key: queryKey, pageSize } as ViewParams }
}
