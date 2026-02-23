import { useDefaultCollectionIds } from '@/features/collection/hooks'
import { getSupabase } from '@/lib/store/client'
import {
  viewCollectionItemsForCard,
  viewCollectionItemsForUser,
  viewCollectionsForCard,
} from '@/lib/store/functions/collections'
import { qk } from '@/lib/store/functions/helpers'
import { CollectionItemRow, CollectionRow } from '@/lib/store/functions/types'
import { DefaultError, keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import React from 'react'
import { ViewParams } from '../card/types'
import { useIsWishlisted } from '../card/wishlist'
import {
  CollectionIdArgs,
  CollectionItem,
  CollectionLike,
  CollectionView,
  InfQueryOptions,
  InifiniteQueryParams,
} from './types'

export function useViewCollectionsForCard(cardId = '', query?: string) {
  const { data: isWishlisted } = useIsWishlisted('card', [cardId])

  const base = useQuery<CollectionLike[], DefaultError>({
    queryKey: [...qk.collectionForCard(cardId), ...(query ? ['query', query] : [])],
    queryFn: () => viewCollectionsForCard(cardId, query),
    placeholderData: keepPreviousData,
    enabled: !!cardId && !!cardId.length,
    // keep: no select here
  })

  const data = React.useMemo<CollectionView>(() => {
    const collections = base.data ?? []

    const wishListCollection: CollectionLike = {
      id: 'wishlist',
      name: 'Wishlist',
      description: 'Cards you have wishlisted',
      visibility: 'private',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      has_item: true,
    } as any

    const included = collections.filter((c) => c.has_item)
    const excluded = collections.filter((c) => !c.has_item)

    if (isWishlisted?.has(cardId)) included.unshift(wishListCollection)
    else excluded.unshift(wishListCollection)

    return { included, excluded }
  }, [base.data, isWishlisted, cardId])

  return { ...base, data }
}

export function useViewCollectionItemsForCard(
  collectionId?: string,
  cardId?: string,
  enabled?: boolean
) {
  return useQuery<CollectionItem[], DefaultError, CollectionItem[]>({
    queryKey: [
      //@ts-ignore
      ...qk.collectionItems(collectionId),
      ...(cardId ? ['cardId', cardId] : []),
    ],
    //@ts-ignore
    queryFn: () => viewCollectionItemsForCard(collectionId, cardId),
    placeholderData: keepPreviousData,
    enabled: enabled && !!cardId && !!collectionId,
    initialData: [],
  })
}

export const DEFAULT_INF_Q_OPTIONS: InfQueryOptions<CollectionItemRow> = {
  pageSize: 50,
  kind: 'card',
}

export function useViewCollectionForUser(hideDefaults = false) {
  return useQuery<{}, DefaultError, CollectionRow[]>({
    queryKey: [...qk.userCollections, hideDefaults ? 'hide-defaults' : 'all'],
    queryFn: viewCollectionItemsForUser(hideDefaults),
    placeholderData: keepPreviousData,
    initialData: [],
  })
}

export function useViewCollectionItems<T extends CollectionItemRow>(opts: InifiniteQueryParams<T>) {
  let { queryKey, getNextPageParam, ...infiniteQueryOpts } = opts

  const query = useInfiniteQuery({
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryKey,
    getNextPageParam,
    ...infiniteQueryOpts,
  })

  return { query, viewParams: { key: queryKey } as ViewParams }
}
export function useCollectionTotal(args: CollectionIdArgs) {
  const { collectionId, collectionType } = args ?? {}
  const isDefaultType =
    collectionType === 'wishlist' || collectionType === 'selling' || collectionType === 'vault'

  const { data: defaultCollectionIds } = useDefaultCollectionIds(isDefaultType)
  const defaultCollectionId =
    collectionType !== 'default' && collectionType !== undefined
      ? (defaultCollectionIds?.[collectionType as keyof typeof defaultCollectionIds] ?? undefined)
      : undefined
  const resultingId = collectionId || defaultCollectionId
  return useQuery<number>({
    enabled: Boolean(resultingId) || isDefaultType,
    queryKey: [...qk.collections, resultingId ?? collectionType, 'totals'],
    staleTime: 60_000, // tweak to taste
    queryFn: async () => {
      if (resultingId) {
        const { data, error } = await getSupabase()
          .from('collection_totals')
          .select('total_cents')
          .eq('collection_id', resultingId)
          .maybeSingle()
        if (error) throw error
        return data?.total_cents ?? 0
      }

      if (isDefaultType) {
        const { data, error } = await getSupabase().rpc('collection_totals_for_user')
        if (error) throw error
        const row = Array.isArray(data) ? data[0] : data
        if (!row) return 0
        const keyMap: Record<string, keyof typeof row> = {
          wishlist: 'wishlist_total_cents',
          selling: 'selling_total_cents',
          vault: 'vault_total_cents',
        }
        const key = keyMap[collectionType!]
        return (row as any)?.[key] ?? 0
      }

      return 0
    },
  })
}

export function useWishlistTotal() {
  // Backwards-compatible wrapper for wishlist totals.
  return useCollectionTotal({ collectionType: 'wishlist' })
}
