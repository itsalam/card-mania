import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useQuery } from '@tanstack/react-query'

const getUserProfile = async (userId: string) => {
  let q = await getSupabase()
    .from('user_profile')
    .select('display_name, avatar_url, bio, location, is_seller, is_hobbyiest, last_seen_at')
    .eq('user_id', userId)
    .maybeSingle()
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
