// =========================
// COLLECTIONS
// =========================

import { supabase } from "../client"
import { requireUser, unwrap } from "./helpers"
import { CollectionItemRow, CollectionRow, CollectionUpdate, ViewTarget } from "./types"

/** Create a new collection (RPC: create_collection) */
export async function createCollection(name: string, opts?: {
  description?: string | null
  isPublic?: boolean
}) {
  await requireUser()
  const { data, error } = await supabase.rpc('create_collection', {
    p_name: name,
    p_desc: opts?.description ?? null,
    p_is_public: opts?.isPublic ?? false,
  })
  if (error) throw error
  // data should be the new UUID returned by the function
  return data as string
}

/** Update collection fields (owner-only via RLS) */
export async function updateCollection(collectionId: string, patch: CollectionUpdate) {
  await requireUser()
  const { data, error } = await supabase
    .from('collections')
    .update(patch)
    .eq('id', collectionId)
    .select()
    .single()
  return unwrap(data as CollectionRow, error)
}

/** Delete a collection (items cascade via FK) */
export async function deleteCollection(collectionId: string) {
  await requireUser()
  const { error } = await supabase.from('collections').delete().eq('id', collectionId)
  if (error) throw error
  return true
}

/** List my collections with item counts */
export async function listMyCollections() {
  await requireUser()
  const { data, error } = await supabase
    .from('collections')
    .select('id,name,description,is_public,cover_image_url,slug,created_at,collection_items(count)')
    .order('created_at', { ascending: false })
  return unwrap(
    (data as (CollectionRow & { collection_items: { count: number }[] })[]) ?? [],
    error,
  )
}

/** Fetch collection items (owner or public via RLS) */
export async function getCollectionItems(collectionId: string) {
  const { data, error } = await supabase
    .from('collection_items')
    .select('id,collection_id,target_type,target_id,position,note,added_at')
    .eq('collection_id', collectionId)
    .order('position')
  return unwrap(data as CollectionItemRow[], error)
}

/** Add an item to a collection (RPC: add_to_collection) */
export async function addToCollection(params: {
  collectionId: string
  targetType: ViewTarget
  targetId: string
  note?: string | null
}) {
  await requireUser()
  const { error } = await supabase.rpc('add_to_collection', {
    p_collection_id: params.collectionId,
    p_target_type: params.targetType,
    p_target_id: params.targetId,
    p_note: params.note ?? null,
  })
  if (error) throw error
  return true
}

/** Remove an item from a collection */
export async function removeFromCollection(collectionId: string, targetType: ViewTarget, targetId: string) {
  await requireUser()
  const { error } = await supabase
    .from('collection_items')
    .delete()
    .match({ collection_id: collectionId, target_type: targetType, target_id: targetId })
  if (error) throw error
  return true
}

/** Reorder items by providing their IDs in the desired order */
export async function reorderCollectionItems(collectionId: string, orderedItemIds: number[]) {
  await requireUser()
  // Update positions one-by-one (PostgREST doesn't support case/when batch easily)
  // Keep it simple; for many items consider a SQL RPC for atomic bulk update.
  const updates = orderedItemIds.map((id, idx) =>
    supabase.from('collection_items').update({ position: idx }).match({ id, collection_id: collectionId })
  )
  const results = await Promise.all(updates)
  const error = results.find((r) => r.error)?.error
  if (error) throw error
  return true
}

// =========================
// PUBLIC COLLECTION READS
// =========================

/** Fetch a public collection and its item count by id */
export async function getPublicCollection(collectionId: string) {
  const { data, error } = await supabase
    .from('collections')
    .select('id,name,description,is_public,cover_image_url,slug,created_at,collection_items(count)')
    .eq('id', collectionId)
    .eq('is_public', true)
    .maybeSingle()
  if (error) throw error
  return data as (CollectionRow & { collection_items: { count: number }[] }) | null
}