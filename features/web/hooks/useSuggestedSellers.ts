import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { useQuery } from '@tanstack/react-query'

export function useSuggestedSellers() {
  const userId = useUserStore((s) => s.user?.id)

  return useQuery({
    queryKey: ['web', 'suggested-sellers', userId ?? 'anon'],
    queryFn: async () => {
      const { data } = await getSupabase().rpc('get_suggested_sellers', {
        exclude_user_id: userId ?? null,
        result_limit: 8,
      })
      return data ?? []
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}
