import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useQuery } from '@tanstack/react-query'

export const getUserStoreFront = async (userId?: string) => {
  let q = getSupabase()
    .from('collections')
    .select('*')
    .eq('user_id', userId ?? '')
    .eq('is_storefront', true)
  const { data, error } = await q

  if (error) throw error
  return data
}

export const useUserStorefront = (userId?: string) => {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: [qk.profile, userId, 'storefront'],
    queryFn: () => getUserStoreFront(userId),
    staleTime: 60 * 60 * 1000 * 24, // 24h
    gcTime: 60 * 60 * 1000 * 48, // 48h
  })
}
