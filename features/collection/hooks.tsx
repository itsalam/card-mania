import { getWishlistQueryArgs } from '@/client/card/wishlist'
import { DEFAULT_INF_Q_OPTIONS, useViewCollectionItems } from '@/client/collections/query'
import { InfQueryOptions, InifiniteQueryParams } from '@/client/collections/types'
import { supabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { Database } from '@/lib/store/supabase'
import { TCard } from '@/constants/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { PageTypes } from './provider'

const COLLECTION_UI_PREFERENCES_KEY = 'collections-ui-preferences'

export type CollectionUiPreferences = {
  layout?: 'grid' | 'list'
  sortBy?: string
  tabs?: string[]
  [key: string]: unknown
}

export type PreferenceState = {
  preferences: CollectionUiPreferences
  loading: boolean
  error: string | null
  refresh: () => void
  updatePreferences: (updates: Partial<CollectionUiPreferences>) => Promise<void>
}

const defaultCollectionUiPreferences: CollectionUiPreferences = {}

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
      if (stored) {
        const parsed = JSON.parse(stored)
        setPreferences({ ...defaultCollectionUiPreferences, ...(parsed ?? {}) })
      } else {
        setPreferences(defaultCollectionUiPreferences)
      }
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
      let nextValue: CollectionUiPreferences = defaultCollectionUiPreferences

      setPreferences((prev) => {
        nextValue = { ...defaultCollectionUiPreferences, ...prev, ...updates }
        return nextValue
      })

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

type CollectionItemQueryRow =
  Database['public']['Functions']['collection_item_query']['Returns'][number]
type WishlistRow = Database['public']['Views']['wishlist_cards_enriched']['Row'] & TCard

type CollectionArgs =
  | { collectionId: string; collectionType: Exclude<PageTypes, 'wishlist'> }
  | { collectionId?: undefined; collectionType: 'wishlist' }

type CollectionReturn<T extends CollectionArgs> = T extends { collectionType: 'wishlist' }
  ? WishlistRow
  : CollectionItemQueryRow

function getCollectionArgs<T extends CollectionArgs>(
  { collectionId, collectionType }: T,
  opts?: InfQueryOptions<CollectionReturn<T>>
): InifiniteQueryParams<CollectionReturn<T>> {
  opts = opts ?? DEFAULT_INF_Q_OPTIONS

  if (collectionId) {
    const { pageSize, search, kind, ...queryOpts } = opts
    return {
      ...queryOpts,
      queryKey: [...qk.collections, collectionId],
      queryFn: async ({ pageParam }) => {
        const { data, error } = await supabase.rpc('collection_item_query', {
          p_collection_id: collectionId,
          p_page_param: pageParam as string,
          p_search: search,
          p_page_size: pageSize,
        })

        if (error) throw error
        return data as CollectionReturn<T>[]
      },
      getNextPageParam: (lastPage) =>
        lastPage?.length ? lastPage[lastPage.length - 1].created_at : null,
      initialPageParam: null as string | null,
    }
  }

  if (collectionType === 'wishlist') {
    return {
      ...(opts as InfQueryOptions<WishlistRow>),
      ...getWishlistQueryArgs(opts as InfQueryOptions<WishlistRow>),
    } as InifiniteQueryParams<CollectionReturn<T>>
  }

  // Future collection types should be added here.
  throw new Error('Unsupported collection type')
}

export function useGetCollectionItems<T extends CollectionArgs>(
  args: T,
  opts?: InfQueryOptions<CollectionReturn<T>>
) {
  const queryArgs = getCollectionArgs(args, opts)
  return useViewCollectionItems<CollectionReturn<T>>(queryArgs)
}
