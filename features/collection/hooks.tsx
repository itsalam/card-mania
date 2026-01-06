import { getWishlistCollectionId, getWishlistQueryArgs } from '@/client/card/wishlist'
import { DEFAULT_INF_Q_OPTIONS, useViewCollectionItems } from '@/client/collections/query'
import { CollectionIdArgs, InfQueryOptions, InifiniteQueryParams } from '@/client/collections/types'
import { supabase } from '@/lib/store/client'
import { qk, requireUser, unwrap } from '@/lib/store/functions/helpers'
import { CollectionItemQueryView, CollectionItemRow } from '@/lib/store/functions/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { defaultPages, DefaultPageTypes } from './provider'

const COLLECTION_UI_PREFERENCES_KEY = 'collections-ui-preferences'

export type CollectionUiPreferences = {
  layout?: 'grid' | 'list'
  sortBy?: string
  tabs?: string[]
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
  tabs: defaultPages.slice(1),
  defaultIds: {},
}

export function useCollectionUiPreferences() {
  const [preferences, setPreferences] = useState<CollectionUiPreferences>(
    defaultCollectionUiPreferences
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const stored = await AsyncStorage.getItem(COLLECTION_UI_PREFERENCES_KEY)
      let isDirty = false
      let preferences: Partial<CollectionUiPreferences> = defaultCollectionUiPreferences
      if (stored) {
        const parsed = JSON.parse(stored)
        preferences = { ...preferences, ...(parsed ?? {}) }
      }
      if (
        !preferences.defaultIds ||
        Object.values(preferences.defaultIds).filter(Boolean).length === 0
      ) {
        const wishlistId = getWishlistCollectionId()
        const defaultIds = {
          wishlist: await wishlistId,
        }
        let isDirty = true
        const ids = Object.values(defaultIds).filter(Boolean)
        const tabs = preferences.tabs?.filter((t) => !ids.includes(t))
        preferences = { ...preferences, tabs, defaultIds }
      }

      if (isDirty) {
        AsyncStorage.setItem(COLLECTION_UI_PREFERENCES_KEY, JSON.stringify(preferences))
      }

      setPreferences(preferences as CollectionUiPreferences)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection UI preferences')
      setPreferences(defaultCollectionUiPreferences)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  const updatePreferences = useCallback(async (updates: Partial<CollectionUiPreferences>) => {
    setError(null)
    setLoading(true)

    try {
      let nextValue: CollectionUiPreferences = {
        ...defaultCollectionUiPreferences,
        ...preferences,
        ...updates,
      }
      setPreferences(nextValue)
      await AsyncStorage.setItem(COLLECTION_UI_PREFERENCES_KEY, JSON.stringify(nextValue))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update collection UI preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    preferences,
    loading,
    error,
    refresh: loadPreferences,
    updatePreferences,
  }
}

function getCollectionItemsArgs<T extends CollectionItemRow>(
  { collectionId, collectionType }: CollectionIdArgs,
  opts?: InfQueryOptions<T>,
  group?: boolean
): InifiniteQueryParams<T> {
  const finalOpts = { ...DEFAULT_INF_Q_OPTIONS, ...opts } as InfQueryOptions<T>
  if (collectionType === 'default') {
    return {
      enabled: false,
      queryKey: [qk.userCollections, 'default', 'items'],
      queryFn: async () => [] as T[],
      getNextPageParam: () => null,
      initialPageParam: null,
    }
  }
  if (collectionId) {
    const { pageSize, search, kind, ...queryOpts } = finalOpts
    return {
      ...queryOpts,
      queryKey: [...qk.collectionItems(collectionId), 'infinite'],
      queryFn: async ({ pageParam }) => {
        const { data, error } = await supabase.rpc('collection_item_query', {
          p_collection_id: collectionId,
          p_page_param: pageParam as string,
          p_search: search,
          p_page_size: pageSize,
          p_group: true,
        })
        if (error) throw error
        return (data ?? []) as unknown as T[]
      },
      getNextPageParam(lastPage) {
        return lastPage?.length ? lastPage[lastPage.length - 1].created_at : null
      },
      initialPageParam: null as string | null,
    }
  }

  if (collectionType === 'wishlist') {
    return {
      ...finalOpts,
      ...getWishlistQueryArgs(finalOpts),
    } as InifiniteQueryParams<T>
  }

  // Future collection types should be added here.
  throw new Error('Unsupported collection type')
}

export function useGetCollection(args: CollectionIdArgs) {
  const isWishlist = args.collectionType === 'wishlist'

  return useQuery({
    enabled: Object.values(args).some(Boolean),
    queryKey: [...qk.collections, ...Object.values(args)],
    staleTime: 60_000, // tweak to taste
    queryFn: async () => {
      // 1) Check existence with a cheap HEAD+COUNT (RLS: returns only your row if any)
      let req = supabase.from('collections').select('*')
      if (isWishlist) {
        const user = await requireUser()
        req = req.eq('user_id', user.id).eq('is_wishlist', true)
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
      const { count, error } = await supabase
        .from('collection_items')
        .select('id', { count: 'exact', head: true })
        .eq('collection_id', args.collectionId!)

      if (error) throw error
      return count ?? 0
    },
  })
}

export function useGetCollectionItems<T extends CollectionItemQueryView>(
  args: CollectionIdArgs,
  opts?: InfQueryOptions<T>,
  group?: boolean
) {
  const queryArgs = getCollectionItemsArgs<T>(args, opts, group)
  return useViewCollectionItems<T>(queryArgs)
}
