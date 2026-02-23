// =========================
// COLLECTIONS
// =========================

import { ItemKinds } from '@/constants/types'
import { getSupabase } from '@/lib/store/client'
import { Database } from '../supabase'
import { requireUser, unwrap } from './helpers'
import {
  CollectionItemRow,
  CollectionRow,
  CollectionUpdate,
  CollectionWithTagRow,
  ViewTarget,
} from './types'

export async function viewCollectionsForCard(cardId: string, query = null as string | null) {
  const user = await requireUser()
  const { data, error } = await (
    query !== null
      ? getSupabase().rpc('collections_with_membership_query', {
          p_user: user.id,
          p_card: cardId,
          p_query: query as string,
        })
      : getSupabase().rpc('collections_with_membership', { p_user: user.id, p_card: cardId })
  )
    .select('*')
    .order('updated_at', { ascending: false })
  return unwrap(data, error)
}

export async function viewCollectionItemsForCard(collectionId: string, cardId: string) {
  const { data, error } = await getSupabase()
    .rpc('collection_items_by_ref', { p_ref_id: cardId, p_collection_id: collectionId })
    .select('*, grade_condition:grade_condition_id(id, company_id, grade_value, label)')

  const formattedData = unwrap(data, error)
  let records = Array.isArray(formattedData) ? formattedData : [formattedData]

  const result = records.map((r) => ({
    ...r,
    grade_condition: r.grade_condition
      ? (r.grade_condition as unknown as Database['public']['Tables']['grade_conditions']['Row'])
      : null,
  }))
  return result
}

export const viewCollectionItemsForUser =
  (hideDefaults = false) =>
  async () => {
    const user = await requireUser()
    const req = getSupabase().from('collections').select('*').eq('user_id', user.id)

    if (hideDefaults) {
      // Include rows where the flags are either false or null
      req.not('is_selling', 'is', true).not('is_vault', 'is', true).not('is_wishlist', 'is', true)
    }

    const { data, error } = await req
    return unwrap(data, error)
  }

// /** Create a new collection (RPC: create_collection) */
// export async function createCollection(name: string, opts?: {
//   description?: string | null;
//   isPublic?: boolean;
// }) {
//   await requireUser();
//   const { data, error } = await getSupabase().rpc("create_collection", {
//     p_name: name,
//     p_desc: opts?.description ?? undefined,
//     p_is_public: opts?.isPublic ?? false,
//   });
//   if (error) throw error;
//   // data should be the new UUID returned by the function
//   return data as string;
// }

/** Update collection fields (owner-only via RLS) */
export async function updateCollection(collectionId: string, patch: CollectionUpdate) {
  await requireUser()
  const { data, error } = await getSupabase()
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
  const { error } = await getSupabase().from('collections').delete().eq('id', collectionId)
  if (error) throw error
  return true
}

/** List my collections with item counts */
export async function listMyCollections() {
  await requireUser()
  const { data, error } = await getSupabase()
    .from('collections_with_tags')
    .select(
      'id,name,description,visibility,cover_image_url,created_at,collection_items:collection_items!collection_id(count),tags_cache'
    )
    .order('created_at', { ascending: false })
  return unwrap(
    (data as (CollectionWithTagRow & {
      collection_items: { count: number }[]
    })[]) ?? [],
    error
  )
}

/** Fetch collection items (owner or public via RLS) */
export async function getCollectionItems(collectionId: string) {
  const { data, error } = await getSupabase()
    .from('collection_items')
    .select()
    .eq('collection_id', collectionId)
    .order('position')
  return unwrap(data as CollectionItemRow[], error)
}

/** Add an item to a collection (RPC: add_to_collection) */
export async function addToCollection(
  params: Extract<
    Database['public']['Functions']['add_to_collection']['Args'],
    { p_item_kind: ItemKinds }
  >
) {
  await requireUser()
  const { error } = await getSupabase().rpc('add_to_collection', {
    ...params,
  })
  if (error) throw error
  return true
}

/** Remove an item from a collection */
export async function removeFromCollection(
  collectionId: string,
  targetType: ViewTarget,
  targetId: string
) {
  await requireUser()
  const { error } = await getSupabase().from('collection_items').delete().match({
    collection_id: collectionId,
    target_type: targetType,
    target_id: targetId,
  })
  if (error) throw error
  return true
}

/** Reorder items by providing their IDs in the desired order */
export async function reorderCollectionItems(collectionId: string, orderedItemIds: number[]) {
  await requireUser()
  // Update positions one-by-one (PostgREST doesn't support case/when batch easily)
  // Keep it simple; for many items consider a SQL RPC for atomic bulk update.
  const updates = orderedItemIds.map((id, idx) =>
    getSupabase().from('collection_items').update({ position: idx }).match({
      id,
      collection_id: collectionId,
    })
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
  const { data, error } = await getSupabase()
    .from('collections')
    .select('id,name,description,visibility,cover_image_url,created_at,collection_items(count)')
    .eq('id', collectionId)
    .eq('visibility', 'public')
    .maybeSingle()
  if (error) throw error
  return data as (CollectionRow & { collection_items: { count: number }[] }) | null
}
