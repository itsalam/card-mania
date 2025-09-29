// Supabase client + typed helper functions for your Expo app (CardMania)
// - Wraps your SQL RPCs and tables with small, safe TS functions
// - Uses publishable key (EXPO_PUBLIC_SUPABASE_KEY)
// - Replace the `Database` import path with your generated types

import { addToCollection, createCollection } from './collections'
import { listMyRecentViews, touchRecentView } from './recently-viewed'
import { ViewTarget } from './types'
// If you generated types with `supabase gen types typescript`, import them:
// import type { Database } from '@/packages/types/src/database.types'
// If you haven't yet, you can temporary alias Database to any:
// type Database = any

// ---- ENV ----


// =========================
// UTILITIES / EXAMPLES
// =========================

/** Convenience: create a collection and add many items */
export async function createCollectionWithItems(name: string, entries: { type: ViewTarget; id: string; note?: string }[], opts?: { description?: string | null; isPublic?: boolean }) {
  const collectionId = await createCollection(name, opts)
  for (const e of entries) {
    await addToCollection({ collectionId, targetType: e.type, targetId: e.id, note: e.note })
  }
  return collectionId
}

/** Example: record a view and refresh the recent list */
export async function recordViewAndGetRecent(target: { type: ViewTarget; id: string }, limit = 25) {
  await touchRecentView({ targetType: target.type, targetId: target.id })
  return listMyRecentViews(limit)
}

// End of module
