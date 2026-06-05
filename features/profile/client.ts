import { CollectionLike } from '@/client/collections/types'
import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useQuery } from '@tanstack/react-query'

export const getUserStoreFront = async (userId?: string) => {
  const { data: session } = await getSupabase().auth.getSession()
  console.log('[Storefront] getUserStoreFront — userId:', userId)
  console.log('[Storefront] auth session at collections fetch:', {
    hasSession: Boolean(session.session),
    callerId: session.session?.user?.id ?? null,
    role: session.session?.user?.role ?? null,
    aud: session.session?.user?.aud ?? null,
  })

  const { data, error } = await getSupabase()
    .from('collections')
    .select('*')
    .eq('user_id', userId ?? '')
    .eq('is_storefront', true)

  if (error) {
    console.error('[Storefront] collections query error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    throw error
  }

  console.log('[Storefront] collections result:', {
    count: data?.length ?? 0,
    ids: data?.map((c) => c.id) ?? [],
  })

  return data as CollectionLike[]
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
