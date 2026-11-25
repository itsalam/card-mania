// ITS-200: custom card order within a collection. The server sorts collection_item_query by
// position, then newest first; reorder_collection_items saves positions by card (copies of a
// card move together). New cards have position 0, so they show above the custom order.

import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { CollectionItemQueryView } from '@/lib/store/functions/types'
import { reportError } from '@/lib/utils/report-error'
import { InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/** Cursor for the next page: the last row's sort key. */
export type CollectionPageCursor = { position: number; createdAt: string }

export function nextCollectionPageCursor(
  lastPage:
    | { sort_position?: number | null; sort_created_at?: string | null; created_at?: string }[]
    | undefined,
  pageSize: number
): CollectionPageCursor | null {
  if (!lastPage?.length || lastPage.length < pageSize) return null
  const last = lastPage[lastPage.length - 1]
  const createdAt = last.sort_created_at ?? last.created_at
  if (!createdAt) return null
  return { position: last.sort_position ?? 0, createdAt }
}

export function collectionPageCursorArgs(cursor: CollectionPageCursor | null | undefined) {
  return cursor ? { p_page_param: cursor.createdAt, p_page_position: cursor.position } : {}
}

const ORDER_PAGE_SIZE = 200

/** Every card in the collection, one row per card, in display order. */
export async function fetchCollectionOrder(collectionId: string) {
  const rows: CollectionItemQueryView[] = []
  let cursor: CollectionPageCursor | null = null
  // Bounded so a runaway loop can't hang the sheet; 50 pages is 10,000 cards.
  for (let page = 0; page < 50; page++) {
    const { data, error } = await getSupabase().rpc('collection_item_query', {
      p_collection_id: collectionId,
      p_page_size: ORDER_PAGE_SIZE,
      p_group: true,
      ...collectionPageCursorArgs(cursor),
    })
    if (error) throw error
    const pageRows = (data ?? []) as CollectionItemQueryView[]
    rows.push(...pageRows)
    cursor = nextCollectionPageCursor(pageRows, ORDER_PAGE_SIZE)
    if (!cursor) break
  }
  return rows
}

export function useCollectionOrder(collectionId: string | undefined, enabled: boolean) {
  return useQuery({
    enabled: Boolean(collectionId) && enabled,
    queryKey: [...qk.collectionItems(collectionId), 'order'],
    queryFn: () => fetchCollectionOrder(collectionId!),
    // Always start the sheet from the server's current order.
    staleTime: 0,
    gcTime: 0,
  })
}

type ItemsPage = (CollectionItemQueryView & Record<string, unknown>)[]

/** Re-sorts loaded pages to match `refIds`; cards not in it (new ones) stay on top. */
function applyOrder(data: InfiniteData<ItemsPage> | undefined, refIds: string[]) {
  if (!data?.pages) return data
  const rank = new Map(refIds.map((id, i) => [id, i + 1]))
  const sizes = data.pages.map((p) => p?.length ?? 0)
  const flat = data.pages.flat()
  const sorted = flat
    .map((row, i) => ({ row, i, r: rank.get(row.ref_id) ?? 0 }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ row, r }) => ({ ...row, position: r, sort_position: r }))
  const pages: ItemsPage[] = []
  let at = 0
  for (const size of sizes) {
    pages.push(sorted.slice(at, at + size))
    at += size
  }
  return { ...data, pages }
}

export function useReorderCollection(collectionId: string | undefined) {
  const qc = useQueryClient()
  const itemsKey = qk.collectionItems(collectionId)

  return useMutation({
    mutationFn: async (refIds: string[]) => {
      const { error } = await getSupabase().rpc('reorder_collection_items', {
        p_collection_id: collectionId!,
        p_ref_ids: refIds,
      })
      if (error) throw error
    },
    // Show the new order immediately in every loaded list for this collection; roll back on
    // error (CLAUDE.md interaction rules).
    onMutate: async (refIds) => {
      await qc.cancelQueries({ queryKey: itemsKey })
      const previous = qc.getQueriesData<InfiniteData<ItemsPage>>({ queryKey: itemsKey })
      for (const [key, data] of previous) {
        if (data && 'pages' in data) {
          qc.setQueryData(key, applyOrder(data, refIds))
        }
      }
      return { previous }
    },
    onError: (err, refIds, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data)
      reportError({
        context: 'useReorderCollection',
        error: err,
        metadata: { collectionId, count: refIds.length },
      })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: itemsKey })
    },
  })
}
