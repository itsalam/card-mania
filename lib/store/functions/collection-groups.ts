// =========================
// COLLECTION GROUPS — "Pinned" (uses RPCs: touch_pinned_collection, remove_pinned_collection)
// =========================

import { getSupabase } from '@/lib/store/client'
import { unwrap } from './helpers'
import { PinnedCollectionItemRow } from './types'

/** Pin/touch a collection into the current user's Pinned group — bumps last_viewed_at if already pinned. */
export async function touchPinnedCollection(collectionId: string) {
  const { error } = await getSupabase().rpc('touch_pinned_collection', {
    p_collection_id: collectionId,
  })
  if (error) throw error
  return true
}

/** Fetch the current user's Pinned group items, in stable added-order. */
export async function listMyPinnedCollections(limit = 100) {
  const { data, error } = await getSupabase()
    .from('my_pinned_collection_items')
    .select('*')
    .order('added_at', { ascending: true })
    .limit(limit)
  return unwrap<PinnedCollectionItemRow[]>(data, error)
}

/** Remove a collection from the current user's Pinned group. */
export async function removePinnedCollection(collectionId: string) {
  const { error } = await getSupabase().rpc('remove_pinned_collection', {
    p_collection_id: collectionId,
  })
  if (error) throw error
  return true
}
