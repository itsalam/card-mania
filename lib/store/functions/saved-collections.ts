// =========================
// SAVED COLLECTIONS (uses RPC: touch_saved_collection)
// =========================

import { getSupabase } from '@/lib/store/client'
import { requireUser, unwrap } from './helpers'
import { SavedCollectionRow } from './types'

/** Save/touch a collection for the current user — bumps last_viewed_at if already saved. */
export async function touchSavedCollection(collectionId: string) {
  const { error } = await getSupabase().rpc('touch_saved_collection', {
    p_collection_id: collectionId,
  })
  if (error) throw error
  return true
}

/** Fetch the current user's saved collections, in stable saved-order. */
export async function listMySavedCollections(limit = 100) {
  const user = await requireUser()
  const { data, error } = await getSupabase()
    .from('saved_collections')
    .select('*')
    .eq('user_id', user.id)
    .order('saved_at', { ascending: true })
    .limit(limit)
  return unwrap<SavedCollectionRow[]>(data, error)
}

/** Remove a collection from the current user's saved list. */
export async function removeSavedCollection(collectionId: string) {
  const user = await requireUser()
  const { error } = await getSupabase()
    .from('saved_collections')
    .delete()
    .eq('user_id', user.id)
    .eq('collection_id', collectionId)
  if (error) throw error
  return true
}
