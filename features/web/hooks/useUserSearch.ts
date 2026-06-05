import { getSupabase } from '@/lib/store/client'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

export function useUserSearch(query: string) {
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(id)
  }, [query])

  return useQuery({
    queryKey: ['user-search', debounced],
    queryFn: async () => {
      const { data } = await getSupabase()
        .from('user_profile')
        .select('user_id, username, display_name, avatar_url, is_seller')
        .or(`username.ilike.%${debounced}%,display_name.ilike.%${debounced}%`)
        .not('username', 'is', null)
        .limit(8)
      return data ?? []
    },
    enabled: debounced.length >= 2,
  })
}
