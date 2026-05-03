import { getSupabase, supabaseRestFetch } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useUserStore } from '@/lib/store/useUserStore'
import { useQuery } from '@tanstack/react-query'

const getUserProfile = async (userId: string) => {
  let q = await getSupabase()
    .rpc('get_public_profile', {
      target_user_id: userId,
    })
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

export type PublicProfile = {
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_seller: boolean
}

/**
 * Fetches public profiles for a list of user IDs in a single RPC call.
 * Returns a stable Record<userId, PublicProfile> map for O(1) lookups.
 * Results are cached for 24h (stale) / 48h (gc) — same policy as useUserProfile.
 */
const getPublicProfiles = async (userIds: string[]): Promise<Record<string, PublicProfile>> => {
  if (userIds.length === 0) return {}
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('get_public_profiles', {
    user_ids: userIds,
  })
  if (error) throw error
  const map: Record<string, PublicProfile> = {}
  for (const row of data ?? []) {
    map[row.user_id] = row
  }
  return map
}

const getSellers = async (excludeUserId?: string): Promise<PublicProfile[]> => {
  const params: Record<string, string> = {
    select: 'user_id,username,display_name,avatar_url,is_seller',
    is_seller: 'eq.true',
    limit: '10',
    order: 'user_id.asc',
  }
  if (excludeUserId) {
    params['user_id'] = `neq.${excludeUserId}`
  }
  return supabaseRestFetch<PublicProfile>('user_profile', params)
}

/** Fetches up to 10 seller profiles, excluding the current authenticated user. */
export const useSellers = () => {
  const userId = useUserStore((s) => s.user?.id)
  return useQuery({
    queryKey: [...qk.profile, 'sellers', userId ?? 'anon'],
    queryFn: () => getSellers(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Batch-fetches public profiles for a set of user IDs.
 * Deduplicates IDs and skips the query when the list is empty.
 * Safe to call with a changing array — React Query re-fetches only when the
 * sorted key string changes.
 */
export const useProfiles = (userIds: string[]) => {
  // stable, deduplicated key so React Query doesn't refetch on every render
  const dedupedIds = [...new Set(userIds)].sort()
  return useQuery({
    queryKey: [qk.profile, 'batch', dedupedIds],
    queryFn: () => getPublicProfiles(dedupedIds),
    enabled: dedupedIds.length > 0,
    staleTime: 60 * 60 * 1000 * 24, // 24h
    gcTime: 60 * 60 * 1000 * 48, // 48h
  })
}
