import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useQuery } from '@tanstack/react-query'

const getUserProfile = async (userId: string) => {
  let q = await getSupabase().rpc('get_public_profile', { target_user_id: userId }).maybeSingle()
  const { data, error } = await q
  if (error) throw error
  return data
}

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: [qk.profile, userId],
    queryFn: () => getUserProfile(userId),
    staleTime: 60 * 60 * 1000 * 24, // 24h
    gcTime: 60 * 60 * 1000 * 48, // 48h
  })
}
