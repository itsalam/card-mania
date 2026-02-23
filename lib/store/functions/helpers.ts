import { getSupabase } from '@/lib/store/client'
import { PostgrestError } from '@supabase/supabase-js'
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
// Small helper to ensure the user is logged in
export async function requireUser() {
  const { data, error } = await getSupabase().auth.getUser()
  if (error) throw error
  const user = data.user
  if (!user) throw new Error('Not authenticated')
  return user
}

export function unwrap<T>(data: T | null, error: PostgrestError | null): T {
  if (error) throw error
  if (data == null) throw new Error('Not found')
  return data
}

export enum WishlistKey {
  Default = 'wishlist',
  View = 'wishlist/view',
  Totals = 'wishlist/totals',
}

export const qk = {
  me: [supabaseUrl, 'me'] as const,
  card: (cardId: string) => [supabaseUrl, 'card', cardId] as const,
  profile: [supabaseUrl, 'profile'] as const,
  collections: [supabaseUrl, 'collections'] as const,
  userCollections: [supabaseUrl, 'collections', 'me'] as const,
  collectionForCard: (cardId: string, userId?: string) =>
    [supabaseUrl, 'collections', 'card', userId ?? 'me', cardId] as const,
  collectionItems: (id?: string) => [supabaseUrl, 'collections', id, 'items'] as const,
  recent: [supabaseUrl, 'recent', 'me'] as const,
  wishlist: (kind: string) => [supabaseUrl, WishlistKey.Default, kind],
  userCards: (userId?: string) => [supabaseUrl, 'user', userId ?? 'me', 'cards'] as const,
  priceQuery: (cardId?: string, grade?: string | object) => [
    supabaseUrl,
    'price-query',
    cardId,
    grade,
  ],
  suggested: (args: { maxResults?: number; search?: string }) => [
    supabaseUrl,
    'suggested-suggest_tags',
    args.maxResults ?? 8,
    (args.search ?? '').trim(),
  ],
}
