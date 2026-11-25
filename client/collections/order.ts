// ITS-200: card order within a collection. collection_item_query sorts by the collection's
// item_sort (or a sort the viewer picks): custom (position, then newest first), date added, price
// or popularity. reorder_collection_items saves a custom order by card (copies of a card move
// together) and switches the collection to it. New cards have position 0, so in the custom sort
// they show above the ordered ones.

import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { CollectionItemQueryView, CollectionRow } from '@/lib/store/functions/types'
import { reportError } from '@/lib/utils/report-error'
import {
  InfiniteData,
  QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

export type CollectionItemSort =
  'custom' | 'newest' | 'oldest' | 'price_desc' | 'price_asc' | 'popular'

export const COLLECTION_SORTS: { value: CollectionItemSort; label: string }[] = [
  { value: 'custom', label: 'Custom order' },
  { value: 'newest', label: 'Newest added' },
  { value: 'oldest', label: 'Oldest added' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'popular', label: 'Most popular' },
]

export function isCollectionItemSort(value: unknown): value is CollectionItemSort {
  return COLLECTION_SORTS.some((s) => s.value === value)
}

/** The collection's saved sort, falling back to custom for rows that predate it. */
export function collectionSort(collection?: { item_sort?: string | null } | null) {
  return isCollectionItemSort(collection?.item_sort) ? collection.item_sort : 'custom'
}

/** Offset of the next page: everything loaded so far, or null once a page comes back short. */
export function nextCollectionPageOffset(
  lastPage: unknown[] | undefined,
  allPages: unknown[][],
  pageSize: number
): number | null {
  if (!lastPage?.length || lastPage.length < pageSize) return null
  return allPages.reduce((n, page) => n + (page?.length ?? 0), 0)
}

/** Sort and paging args for collection_item_query. Sending p_page_offset selects offset paging. */
export function collectionPageArgs(offset: number | null | undefined, sort?: CollectionItemSort) {
  return { p_page_offset: offset ?? 0, ...(sort ? { p_sort: sort } : {}) }
}

/** Moves the item at `from` to index `to`, returning a new array (the same one if unmoved). */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

const ORDER_PAGE_SIZE = 200

/** Every card in the collection, one row per card, in `sort` order. */
export async function fetchCollectionOrder(collectionId: string, sort: CollectionItemSort) {
  const rows: CollectionItemQueryView[] = []
  // Bounded so a runaway loop can't hang reorder mode; 50 pages is 10,000 cards.
  for (let page = 0; page < 50; page++) {
    const { data, error } = await getSupabase().rpc('collection_item_query', {
      p_collection_id: collectionId,
      p_page_size: ORDER_PAGE_SIZE,
      p_group: true,
      ...collectionPageArgs(rows.length, sort),
    })
    if (error) throw error
    const pageRows = (data ?? []) as CollectionItemQueryView[]
    rows.push(...pageRows)
    if (pageRows.length < ORDER_PAGE_SIZE) break
  }
  return rows
}

/** Reorder mode's starting list: every card, in the order the page currently shows. */
export function useCollectionOrder(
  collectionId: string | undefined,
  enabled: boolean,
  sort: CollectionItemSort
) {
  return useQuery({
    enabled: Boolean(collectionId) && enabled,
    queryKey: [...qk.collectionItems(collectionId), 'order', sort],
    queryFn: () => fetchCollectionOrder(collectionId!, sort),
    // Always start from the server's current order.
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

/** Sets item_sort on every cached copy of the collection (single rows and lists). */
function patchCachedSort(
  qc: ReturnType<typeof useQueryClient>,
  collectionId: string,
  sort: CollectionItemSort
) {
  const previous = qc.getQueriesData<unknown>({ queryKey: qk.collections })
  const patch = (row: unknown) =>
    row && typeof row === 'object' && (row as CollectionRow).id === collectionId
      ? { ...(row as CollectionRow), item_sort: sort }
      : row
  for (const [key, data] of previous) {
    if (Array.isArray(data)) {
      if (data.some((r) => (r as CollectionRow)?.id === collectionId)) {
        qc.setQueryData(key, data.map(patch))
      }
    } else if (data && typeof data === 'object' && (data as CollectionRow).id === collectionId) {
      qc.setQueryData(key, patch(data))
    }
  }
  return previous
}

function restore(qc: ReturnType<typeof useQueryClient>, entries?: [QueryKey, unknown][]) {
  for (const [key, data] of entries ?? []) qc.setQueryData(key, data)
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
    // Show the new order immediately in every loaded list for this collection, and the
    // collection as custom-sorted (the RPC switches it); roll back on error (CLAUDE.md
    // interaction rules).
    onMutate: async (refIds) => {
      await qc.cancelQueries({ queryKey: itemsKey })
      const previous = qc.getQueriesData<InfiniteData<ItemsPage>>({ queryKey: itemsKey })
      for (const [key, data] of previous) {
        if (data && 'pages' in data) {
          qc.setQueryData(key, applyOrder(data, refIds))
        }
      }
      const previousCollections = collectionId ? patchCachedSort(qc, collectionId, 'custom') : []
      return { previous, previousCollections }
    },
    onError: (err, refIds, ctx) => {
      restore(qc, ctx?.previousCollections)
      restore(qc, ctx?.previous)
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

/** Saves the collection's sort (owner only). The list switches at once; rolls back on error. */
export function useSetCollectionSort(collectionId: string | undefined) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (sort: CollectionItemSort) => {
      const { error } = await getSupabase()
        .from('collections')
        .update({ item_sort: sort })
        .eq('id', collectionId!)
      if (error) throw error
    },
    onMutate: async (sort) => {
      await qc.cancelQueries({ queryKey: qk.collections })
      return { previous: patchCachedSort(qc, collectionId!, sort) }
    },
    onError: (err, sort, ctx) => {
      restore(qc, ctx?.previous)
      reportError({
        context: 'useSetCollectionSort',
        error: err,
        metadata: { collectionId, sort },
      })
    },
  })
}
