import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useUserStore } from '@/lib/store/useUserStore'
import { reportError } from '@/lib/utils/report-error'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const followedSellersKey = (userId?: string) => [
  ...qk.profile,
  'followed-sellers',
  userId ?? 'anon',
]

/** All seller ids the current user follows, as a Set for O(1) `.has()` checks in card lists. */
export function useFollowedSellerIds() {
  const userId = useUserStore((s) => s.user?.id)
  return useQuery({
    queryKey: followedSellersKey(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_followed_sellers' as any)
      if (error) throw error
      return new Set((data ?? []).map((row: { seller_id: string }) => row.seller_id))
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}

/**
 * Toggles following a seller. Follows the useToggleWishlist pattern (client/card/wishlist.ts):
 * flip the cached Set synchronously in onMutate, roll back in onError, reconcile with the
 * server's actual result in onSuccess.
 */
export function useToggleSellerFollow() {
  const qc = useQueryClient()
  const userId = useUserStore((s) => s.user?.id)
  const key = followedSellersKey(userId)

  return useMutation({
    mutationFn: async (sellerId: string) => {
      const { data, error } = await getSupabase().rpc('toggle_seller_follow' as any, {
        p_seller_id: sellerId,
      })
      if (error) throw error
      return { sellerId, isFollowing: Boolean(data?.[0]?.is_following) }
    },
    onMutate: async (sellerId: string) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Set<string>>(key)
      qc.setQueryData<Set<string>>(key, (s) => {
        const next = new Set(s ?? [])
        next.has(sellerId) ? next.delete(sellerId) : next.add(sellerId)
        return next
      })
      return { prev }
    },
    onError: (err, sellerId, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev)
      reportError({ context: 'useToggleSellerFollow', error: err, metadata: { sellerId } })
    },
    onSuccess: ({ sellerId, isFollowing }) => {
      qc.setQueryData<Set<string>>(key, (s) => {
        const next = new Set(s ?? [])
        isFollowing ? next.add(sellerId) : next.delete(sellerId)
        return next
      })
    },
  })
}
