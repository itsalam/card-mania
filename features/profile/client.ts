import { CollectionLike } from '@/client/collections/types'
import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useQuery } from '@tanstack/react-query'

export const getUserStoreFront = async (userId?: string) => {
  const { data, error } = await getSupabase()
    .from('collections')
    .select('*')
    .eq('user_id', userId ?? '')
    .eq('is_storefront', true)

  if (error) throw error
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

// ITS-124: the profile Collections tab. Your own profile lists all your collections; anyone
// else's lists the ones they've marked Public (readable via collections_public_read).
// Storefront collections and the Selling mirror are left out (the Storefront tab covers
// them), and so is the Wishlist, whose cards aren't collection items.
export const getUserCollections = async (userId: string, isOwnProfile: boolean) => {
  let req = getSupabase()
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .not('is_storefront', 'is', true)
    .not('is_selling', 'is', true)
    .not('is_wishlist', 'is', true)
  if (!isOwnProfile) req = req.eq('visibility', 'public')

  const { data, error } = await req.order('created_at', { ascending: false })
  if (error) throw error
  return data as CollectionLike[]
}

export const useUserCollections = (userId?: string, isOwnProfile = false) => {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: [qk.profile, userId, 'collections', isOwnProfile ? 'own' : 'public'],
    queryFn: () => getUserCollections(userId!, isOwnProfile),
    staleTime: 5 * 60 * 1000,
  })
}
