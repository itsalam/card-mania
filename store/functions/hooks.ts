// lib/hooks.ts
import { qk } from '@/store/functions/helpers'
import {
    listMyRecentViews, touchRecentView
} from '@/store/functions/recently-viewed'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addToCollection, createCollection, getCollectionItems, listMyCollections, removeFromCollection } from './collections'

export function useMyCollections() {
  return useQuery({ queryKey: qk.collections, queryFn: () => listMyCollections() })
}

export function useCollectionItems(collectionId: string) {
  return useQuery({
    queryKey: qk.collectionItems(collectionId),
    queryFn: () => getCollectionItems(collectionId),
    enabled: !!collectionId,
  })
}

export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { name: string; desc?: string | null; isPublic?: boolean }) =>
      createCollection(args.name, { description: args.desc ?? null, isPublic: !!args.isPublic }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collections }),
  })
}

export function useAddToCollection(collectionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { type: 'card'|'listing'; id: string; note?: string }) =>
      addToCollection({ collectionId, targetType: args.type, targetId: args.id, note: args.note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collectionItems(collectionId) }),
  })
}

export function useRemoveFromCollection(collectionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { type: 'card'|'listing'; id: string }) =>
      removeFromCollection(collectionId, args.type, args.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collectionItems(collectionId) }),
  })
}

export function useRecentViews(limit = 25) {
  return useQuery({ queryKey: qk.recent, queryFn: () => listMyRecentViews(limit) })
}

// Fire-and-forget is fine, but if you show the recent list, invalidate it:
export function useTouchRecentView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { type: 'card'|'listing'; id: string; source?: string }) =>
      touchRecentView({ targetType: args.type, targetId: args.id, source: args.source }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.recent }),
  })
}
