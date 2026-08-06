import { DEFAULT_INF_Q_OPTIONS, useViewCollectionItems } from '@/client/collections/query'
import { CollectionIdArgs, InfQueryOptions, InifiniteQueryParams } from '@/client/collections/types'
import { TCard } from '@/constants/types'
import { getSupabase } from '@/lib/store/client'
import {
  listMyPinnedCollections,
  removePinnedCollection,
  touchPinnedCollection,
} from '@/lib/store/functions/collection-groups'
import { qk, requireUser, unwrap } from '@/lib/store/functions/helpers'
import {
  listMySavedCollections,
  removeSavedCollection,
  touchSavedCollection,
} from '@/lib/store/functions/saved-collections'
import {
  CollectionItemQueryView,
  CollectionItemRow,
  PinnedCollectionItemRow,
  SavedCollectionRow,
} from '@/lib/store/functions/types'
import { useUserStore } from '@/lib/store/useUserStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getDefaultPageCollectionId } from './cached-ids'
import {
  readCachedPinnedCollections,
  writeCachedPinnedCollections,
} from './pinned-collections-cache'
import { defaultPages, DefaultPageTypes } from './provider'
import { readCachedSavedCollections, writeCachedSavedCollections } from './saved-collections-cache'

export type CollectionHistoryPoint = {
  snapshotted_at: string
  total_cents: number
  quantity_total: number
}

/**
 * Fetches real portfolio value history from collection_value_history via the
 * get_portfolio_history RPC. Rows are written on every item change (trigger)
 * and by the nightly pg_cron snapshot.
 */
export function useCollectionHistory(args: CollectionIdArgs, options?: { from?: Date; to?: Date }) {
  const { collectionId, collectionType } = args
  const isDefaultType =
    collectionType === 'wishlist' || collectionType === 'selling' || collectionType === 'vault'

  const { data: defaultCollectionIds } = useDefaultCollectionIds(isDefaultType && !collectionId)
  const resolvedId =
    collectionId ??
    (isDefaultType && collectionType
      ? (defaultCollectionIds?.[collectionType as keyof typeof defaultCollectionIds] ?? undefined)
      : undefined)

  return useQuery<CollectionHistoryPoint[]>({
    enabled: Boolean(resolvedId),
    queryKey: [
      ...qk.collections,
      'history',
      resolvedId,
      options?.from?.toISOString(),
      options?.to?.toISOString(),
    ],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('get_portfolio_history', {
        p_collection_id: resolvedId!,
        ...(options?.from ? { p_from: options.from.toISOString() } : {}),
        ...(options?.to ? { p_to: options.to.toISOString() } : {}),
      })
      if (error) throw error
      return (data ?? []) as CollectionHistoryPoint[]
    },
  })
}

const COLLECTION_UI_PREFERENCES_KEY = 'collections-ui-preferences'

export type CollectionUiPreferences = {
  layout?: 'grid' | 'list'
  sortBy?: string
  defaultIds: Partial<Record<DefaultPageTypes, string | null>>
  [key: string]: unknown
}

export type PreferenceState = {
  preferences: CollectionUiPreferences
  loading: boolean
  error: string | null
  refresh: () => void
  updatePreferences: (updates: Partial<CollectionUiPreferences>) => Promise<void>
}

const defaultCollectionUiPreferences: CollectionUiPreferences = {
  defaultIds: {},
}

export function useDefaultCollectionIds(enabled = true) {
  return useQuery({
    queryKey: [...qk.collections, 'default', 'ids'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [wishlist, selling, vault] = await Promise.all([
        getDefaultPageCollectionId('wishlist'),
        getDefaultPageCollectionId('selling'),
        getDefaultPageCollectionId('vault'),
      ])
      return { wishlist, selling, vault }
    },
  })
}

export function useCollectionUiPreferences() {
  const userId = useUserStore((s) => s.user?.id)
  const [preferences, setPreferences] = useState<CollectionUiPreferences>(
    defaultCollectionUiPreferences
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const defaultIdsRef = useRef<{
    wishlist: string | null
    selling: string | null
    vault: string | null
  } | null>(null)
  const [shouldFetchDefaultIds, setShouldFetchDefaultIds] = useState(true)
  const storageKey = userId
    ? `${COLLECTION_UI_PREFERENCES_KEY}-${userId}`
    : COLLECTION_UI_PREFERENCES_KEY
  const defaultIdsQuery = useDefaultCollectionIds(Boolean(userId) && shouldFetchDefaultIds)

  useEffect(() => {
    defaultIdsRef.current = null
    setShouldFetchDefaultIds(Boolean(userId))
  }, [userId])

  useEffect(() => {
    if (!defaultIdsQuery.data || defaultIdsRef.current) return
    defaultIdsRef.current = defaultIdsQuery.data
    setShouldFetchDefaultIds(false)
  }, [defaultIdsQuery.data])

  const resolveDefaultIds = useCallback(async () => {
    if (!userId) return { wishlist: null, selling: null, vault: null }
    if (defaultIdsRef.current) return defaultIdsRef.current
    const res = await defaultIdsQuery.refetch()
    if (res.error) throw res.error
    defaultIdsRef.current = res.data ?? { wishlist: null, selling: null, vault: null }
    setShouldFetchDefaultIds(false)
    return defaultIdsRef.current
  }, [defaultIdsQuery.refetch, userId])

  const loadPreferences = useCallback(
    async (force?: boolean) => {
      try {
        setLoading(true)
        setError(null)

        const stored = await AsyncStorage.getItem(storageKey)
        let preferences: Partial<CollectionUiPreferences> = defaultCollectionUiPreferences
        if (stored) {
          const parsed = JSON.parse(stored)
          preferences = { ...preferences, ...(parsed ?? {}) }
        }
        if (
          force ||
          !preferences.defaultIds ||
          Object.values(preferences.defaultIds).filter(Boolean).length < defaultPages.length - 1
        ) {
          const defaultIds = await resolveDefaultIds()
          preferences = { ...preferences, defaultIds }
        }

        AsyncStorage.setItem(storageKey, JSON.stringify(preferences))

        setPreferences(preferences as CollectionUiPreferences)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load collection UI preferences')
        setPreferences(defaultCollectionUiPreferences)
      } finally {
        setLoading(false)
      }
    },
    [resolveDefaultIds, storageKey]
  )

  useEffect(() => {
    setPreferences(defaultCollectionUiPreferences)
    loadPreferences()
  }, [loadPreferences, userId])

  const updatePreferences = useCallback(
    async (updates: Partial<CollectionUiPreferences>) => {
      setError(null)
      setLoading(true)

      try {
        let nextValue: CollectionUiPreferences = {
          ...defaultCollectionUiPreferences,
          ...preferences,
          ...updates,
        }
        setPreferences(nextValue)
        await AsyncStorage.setItem(storageKey, JSON.stringify(nextValue))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update collection UI preferences')
      } finally {
        setLoading(false)
      }
    },
    [preferences, storageKey]
  )

  return {
    preferences,
    loading,
    error,
    refresh: loadPreferences,
    updatePreferences,
  }
}

/**
 * Server-backed list of the user's saved collections (defaults, own, and viewed
 * non-owned collections). Seeded from an on-device cache on mount via
 * setQueryData — not initialData, which is only honored the first time a Query
 * is constructed for this key and would be dropped if any consumer mounts this
 * hook before the AsyncStorage read resolves — so staleTime still governs
 * whether a background refetch fires against the seeded (possibly stale) data.
 */
export function useSavedCollections() {
  const userId = useUserStore((s) => s.user?.id)
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: qk.savedCollections(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await listMySavedCollections()
      if (userId) writeCachedSavedCollections(userId, rows)
      return rows
    },
  })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    readCachedSavedCollections(userId).then((cached) => {
      if (cancelled || !cached) return
      qc.setQueryData(qk.savedCollections(userId), cached.data, { updatedAt: cached.ts })
    })
    return () => {
      cancelled = true
    }
  }, [userId, qc])

  return query
}

export function useTouchSavedCollection() {
  const userId = useUserStore((s) => s.user?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (collectionId: string) => touchSavedCollection(collectionId),
    onMutate: (collectionId) => {
      if (!userId) return
      const now = new Date().toISOString()
      qc.setQueryData(qk.savedCollections(userId), (old) => {
        const prev = (old ?? []) as SavedCollectionRow[]
        const existing = prev.find((r) => r.collection_id === collectionId)
        if (existing) {
          return prev.map((r) =>
            r.collection_id === collectionId ? { ...r, last_viewed_at: now } : r
          )
        }
        const optimisticRow: SavedCollectionRow = {
          user_id: userId,
          collection_id: collectionId,
          saved_at: now,
          last_viewed_at: now,
        }
        return [...prev, optimisticRow]
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.savedCollections(userId) }),
  })
}

export function useRemoveSavedCollection() {
  const userId = useUserStore((s) => s.user?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (collectionId: string) => removeSavedCollection(collectionId),
    onMutate: (collectionId) => {
      if (!userId) return
      const prev = qc.getQueryData<SavedCollectionRow[]>(qk.savedCollections(userId))
      qc.setQueryData(
        qk.savedCollections(userId),
        (prev ?? []).filter((r) => r.collection_id !== collectionId)
      )
      return { prev }
    },
    onError: (_err, _collectionId, ctx) => {
      if (ctx?.prev && userId) qc.setQueryData(qk.savedCollections(userId), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.savedCollections(userId) }),
  })
}

/**
 * The user's "Pinned" collection_group items — the tab strip on the Collections
 * page. Same cache-first/SWR shape as useSavedCollections (see its comment).
 */
export function usePinnedCollections() {
  const userId = useUserStore((s) => s.user?.id)
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: qk.pinnedCollections(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await listMyPinnedCollections()
      if (userId) writeCachedPinnedCollections(userId, rows)
      return rows
    },
  })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    readCachedPinnedCollections(userId).then((cached) => {
      if (cancelled || !cached) return
      qc.setQueryData(qk.pinnedCollections(userId), cached.data, { updatedAt: cached.ts })
    })
    return () => {
      cancelled = true
    }
  }, [userId, qc])

  return query
}

export function useTouchPinnedCollection() {
  const userId = useUserStore((s) => s.user?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (collectionId: string) => touchPinnedCollection(collectionId),
    onMutate: (collectionId) => {
      if (!userId) return
      const now = new Date().toISOString()
      qc.setQueryData(qk.pinnedCollections(userId), (old) => {
        const prev = (old ?? []) as PinnedCollectionItemRow[]
        const existing = prev.find((r) => r.collection_id === collectionId)
        if (existing) {
          return prev.map((r) =>
            r.collection_id === collectionId ? { ...r, last_viewed_at: now } : r
          )
        }
        const optimisticRow: PinnedCollectionItemRow = {
          group_id: null,
          collection_id: collectionId,
          added_at: now,
          last_viewed_at: now,
        }
        return [...prev, optimisticRow]
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.pinnedCollections(userId) }),
  })
}

export function useRemovePinnedCollection() {
  const userId = useUserStore((s) => s.user?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (collectionId: string) => removePinnedCollection(collectionId),
    onMutate: (collectionId) => {
      if (!userId) return
      const prev = qc.getQueryData<PinnedCollectionItemRow[]>(qk.pinnedCollections(userId))
      qc.setQueryData(
        qk.pinnedCollections(userId),
        (prev ?? []).filter((r) => r.collection_id !== collectionId)
      )
      return { prev }
    },
    onError: (_err, _collectionId, ctx) => {
      if (ctx?.prev && userId) qc.setQueryData(qk.pinnedCollections(userId), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.pinnedCollections(userId) }),
  })
}

function getCollectionItemsArgs<T extends CollectionItemRow>(
  { collectionId, collectionType }: CollectionIdArgs,
  opts?: InfQueryOptions<T>,
  group?: boolean
): InifiniteQueryParams<T> {
  const finalOpts = { ...DEFAULT_INF_Q_OPTIONS, ...opts } as InfQueryOptions<T>
  const shouldGroup = group ?? Boolean(collectionId)
  if (collectionId) {
    const { pageSize, search, kind, ...queryOpts } = finalOpts
    return {
      ...queryOpts,
      queryKey: [
        ...qk.collectionItems(collectionId),
        'infinite',
        shouldGroup ? 'grouped' : 'ungrouped',
      ],
      queryFn: async ({ pageParam }) => {
        const { data, error } = await getSupabase().rpc('collection_item_query', {
          p_collection_id: collectionId,
          p_page_param: pageParam as string,
          p_search: search,
          p_page_size: pageSize,
          p_group: shouldGroup,
        })
        if (error) throw error
        return (data ?? []) as unknown as T[]
      },
      getNextPageParam(lastPage) {
        if (!lastPage?.length || lastPage.length < pageSize) return null
        return lastPage[lastPage.length - 1].created_at
      },
      initialPageParam: null as string | null,
    }
  } else if (collectionType) {
    //@ts-ignore
    return {
      ...finalOpts,
      ...getDefaultCollectionPageQueryArgs(
        collectionType,
        () => getDefaultPageCollectionId(collectionType),
        finalOpts,
        shouldGroup
      ),
    }
  }
  // Future collection types should be added here.
  throw new Error('Unsupported collection type')
}

export function useGetCollection(args: CollectionIdArgs) {
  const collectionFlag =
    args.collectionType === 'wishlist'
      ? 'is_wishlist'
      : args.collectionType === 'selling'
        ? 'is_selling'
        : args.collectionType === 'vault'
          ? 'is_vault'
          : null

  return useQuery({
    enabled: Object.values(args).some(Boolean),
    queryKey: [...qk.collections, ...Object.values(args)],
    staleTime: 60_000, // tweak to taste
    queryFn: async () => {
      // 1) Check existence with a cheap HEAD+COUNT (RLS: returns only your row if any)
      let req = getSupabase().from('collections').select('*')
      if (collectionFlag) {
        const user = await requireUser()
        req = req.eq('user_id', user.id).eq(collectionFlag, true)
      } else if (args.collectionId) {
        req = req.eq('id', args.collectionId)
      }
      const { data, error } = await req.single()
      return unwrap(data, error)
    },
  })
}

export function useGetCollectionCountInfo(args: CollectionIdArgs) {
  return useQuery({
    enabled: Boolean(args.collectionId),
    queryKey: [...qk.collections, ...Object.values(args), 'count'],
    staleTime: 60_000, // tweak to taste
    queryFn: async () => {
      // Only need the count; use HEAD + count to avoid fetching rows.
      const { count, error } = await getSupabase()
        .from('collection_items')
        .select('id', { count: 'exact', head: true })
        .eq('collection_id', args.collectionId!)

      if (error) throw error
      return count ?? 0
    },
  })
}

export function useGetCollectionItems<
  T extends CollectionItemQueryView = CollectionItemQueryView & TCard,
>(args: CollectionIdArgs, opts?: InfQueryOptions<T>, group?: boolean) {
  const queryArgs = getCollectionItemsArgs<T>(args, opts, group)
  return useViewCollectionItems<T>(queryArgs)
}

export function useGetSingleCollectionItem() {}

type SpoofPricePoint = { day: string; price: number }
type SpoofPriceResponse = {
  seed_used: number
  initial_price: number
  variance: number
  date_span: number
  bucket_days: number
  prices: SpoofPricePoint[]
}

export function useSpoofedCollectionPrices(
  args: CollectionIdArgs,
  totalCents?: number,
  options?: { variance?: number; dateSpan?: number; seed?: number }
) {
  const { collectionId, collectionType } = args ?? {}
  const { variance, dateSpan, seed } = options ?? {}
  const initialPrice = typeof totalCents === 'number' ? Math.max(totalCents, 0) : undefined

  return useQuery<SpoofPriceResponse>({
    enabled: Boolean(initialPrice) && Boolean(collectionId || collectionType),
    queryKey: [
      ...qk.collections,
      'spoof-price',
      collectionId ?? collectionType ?? 'unknown',
      initialPrice,
      variance,
      dateSpan,
      seed,
    ],
    queryFn: async () => {
      const { data, error } = await getSupabase().functions.invoke('spoof_price', {
        body: {
          initial_price: initialPrice,
          variance,
          date_span: dateSpan,
          seed,
        },
        method: 'POST',
      })
      if (error) throw error
      return data as SpoofPriceResponse
    },
    staleTime: 60_000,
  })
}

function getDefaultCollectionPageQueryArgs<T extends CollectionItemRow>(
  collectionType: DefaultPageTypes,
  collecitonIdPromise?: () => Promise<string | null | undefined>,
  opts?: InfQueryOptions<T>,
  group?: boolean
) {
  let { pageSize, search, kind } = { ...DEFAULT_INF_Q_OPTIONS, ...opts }
  const queryKey = [
    [...qk.collectionItems(collectionType), 'infinite', group ? 'grouped' : 'ungrouped'],
  ]

  const args = {
    queryKey,
    getNextPageParam: (lastPage) =>
      lastPage?.length && lastPage.length >= pageSize
        ? lastPage[lastPage.length - 1].created_at
        : null,
    queryFn: async ({ pageParam }) => {
      const collectionId = await collecitonIdPromise?.()
      if (!collectionId) return []

      const { data, error } = await getSupabase().rpc('collection_item_query', {
        p_collection_id: collectionId,
        p_page_param: pageParam as string,
        p_search: search,
        p_page_size: pageSize,
        p_group: group,
      })

      if (error) throw error
      //@ts-ignore
      return (data ?? []) as CollectionItemRow[]
    },
    initialPageParam: null as string | null,
  } as InifiniteQueryParams<CollectionItemRow>

  return args as any as InifiniteQueryParams
}
