import { getSupabase } from '@/lib/store/client'
import { useQuery } from '@tanstack/react-query'

export type SampleStorefront = {
  username: string
  display_name: string | null
  avatar_url: string | null
}

const isDev = process.env.NODE_ENV !== 'production'

// Production: fetch profiles whose user_id is in demo_user_map.demo_user_id
async function fetchDemoUsers(): Promise<SampleStorefront[]> {
  const sb = getSupabase()

  const { data: mapRows, error: mapError } = await sb.from('demo_user_map').select('demo_user_id')

  if (mapError) throw mapError

  const ids = (mapRows ?? []).map((r) => r.demo_user_id)
  if (ids.length === 0) return []

  const { data, error } = await sb
    .from('user_profile')
    .select('username, display_name, avatar_url')
    .in('user_id', ids)
    .not('username', 'is', null)

  if (error) throw error
  return (data ?? []) as SampleStorefront[]
}

// Development: most recently active users with a username set
async function fetchRecentUsers(): Promise<SampleStorefront[]> {
  const { data, error } = await getSupabase()
    .from('user_profile')
    .select('username, display_name, avatar_url')
    .not('username', 'is', null)
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(5)

  if (error) throw error
  return (data ?? []) as SampleStorefront[]
}

export function useSampleStorefronts() {
  return useQuery({
    queryKey: ['web', 'sample-storefronts', isDev ? 'dev' : 'prod'],
    queryFn: isDev ? fetchRecentUsers : fetchDemoUsers,
    staleTime: isDev ? 60_000 : 24 * 60 * 60 * 1000,
  })
}
