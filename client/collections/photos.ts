import { getSupabase } from '@/lib/store/client'
import { qk, requireUser } from '@/lib/store/functions/helpers'
import { Database } from '@/lib/store/supabase'
import { reportError } from '@/lib/utils/report-error'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decode as decodeBase64 } from 'base64-arraybuffer'
import * as crypto from 'expo-crypto'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { ImagePickerAsset } from 'expo-image-picker'

export type CollectionItemImage = Database['public']['Tables']['collection_item_images']['Row']

export const MAX_PHOTOS_PER_ITEM = 6

const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.8

export const photosQueryKey = (collectionItemId?: string) =>
  [...qk.collectionItemSingle(collectionItemId), 'photos'] as const

/** All photos attached to one collection item, ordered for gallery display. */
export function useCollectionItemPhotos(collectionItemId?: string) {
  return useQuery({
    queryKey: photosQueryKey(collectionItemId),
    enabled: Boolean(collectionItemId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('collection_item_images')
        .select('*')
        .eq('collection_item_id', collectionItemId!)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as CollectionItemImage[]
    },
  })
}

export type PrimaryPhotoRow = {
  collection_item_id: string
  image_cache_id: string
  storage_path: string
  width: number | null
  height: number | null
}

export const primaryPhotoQueryKey = (collectionItemId: string) =>
  ['collection-item-images', 'primary', collectionItemId] as const

/**
 * Coalesces primary-photo lookups across independently-mounted `CardListView`
 * instances into one request per debounce window — same shape as
 * `wishlistBatcher` in `client/card/wishlist.ts`.
 */
class PrimaryPhotoBatcher {
  private pending = new Set<string>()
  private resolvers: ((m: Map<string, PrimaryPhotoRow>) => void)[] = []
  private timer?: number

  request(id: string) {
    this.pending.add(id)
    return new Promise<Map<string, PrimaryPhotoRow>>((resolve) => {
      this.resolvers.push(resolve)
      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), 0) as unknown as number
      }
    })
  }

  private async flush() {
    const ids = [...this.pending]
    this.pending.clear()
    this.timer = undefined

    if (!ids.length) {
      this.resolvers.splice(0).forEach((r) => r(new Map()))
      return
    }

    const byItemId = new Map<string, PrimaryPhotoRow>()
    const { data, error } = await getSupabase()
      .from('collection_item_images')
      .select('collection_item_id, image_cache_id, storage_path, width, height')
      .in('collection_item_id', ids)
      .eq('is_primary', true)

    if (error) {
      reportError({ context: 'primaryPhotoBatcher', error, metadata: { ids } })
    } else {
      for (const row of data ?? []) byItemId.set(row.collection_item_id, row)
    }

    this.resolvers.splice(0).forEach((r) => r(byItemId))
  }
}

const primaryPhotoBatcher = new PrimaryPhotoBatcher()

/** A collection item's primary custom photo, if it has one — call from wherever the item renders. */
export function usePrimaryPhoto(collectionItemId?: string) {
  return useQuery({
    queryKey: primaryPhotoQueryKey(collectionItemId ?? ''),
    enabled: Boolean(collectionItemId),
    queryFn: async () => {
      const result = await primaryPhotoBatcher.request(collectionItemId!)
      return result.get(collectionItemId!) ?? null
    },
    staleTime: 60_000,
  })
}

/** Resize (only if oversized) + re-encode as JPEG — also normalizes HEIC input. */
async function prepareImageForUpload(asset: ImagePickerAsset) {
  let context = ImageManipulator.manipulate(asset.uri)
  if (asset.width > MAX_DIMENSION || asset.height > MAX_DIMENSION) {
    const landscape = asset.width >= asset.height
    context = context.resize(landscape ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION })
  }
  const rendered = await context.renderAsync()
  // base64: true avoids RN's fetch(uri).blob(), which silently produces
  // corrupted/empty uploads to Supabase Storage on native — see
  // https://supabase.com/blog/react-native-storage
  return rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true })
}

export function useUploadCollectionItemPhoto(collectionItemId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      asset,
      isPrimary,
    }: {
      asset: ImagePickerAsset
      /** Caller decides — e.g. true when this is the item's first photo. */
      isPrimary?: boolean
    }) => {
      const user = await requireUser()
      const supabase = getSupabase()

      const prepared = await prepareImageForUpload(asset)
      if (!prepared.base64) throw new Error('Failed to encode uploaded image')

      const storagePath = `user-uploads/${user.id}/${collectionItemId}/${crypto.randomUUID()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(storagePath, decodeBase64(prepared.base64), { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const { data: cacheRow, error: cacheError } = await supabase
        .from('image_cache')
        .insert({
          source_url: null,
          storage_path: storagePath,
          status: 'READY',
          mime: 'image/jpeg',
          width: prepared.width,
          height: prepared.height,
        })
        .select()
        .single()
      if (cacheError || !cacheRow) throw cacheError ?? new Error('Failed to cache uploaded image')

      const { data: photoRow, error: photoError } = await supabase
        .from('collection_item_images')
        .insert({
          collection_item_id: collectionItemId,
          user_id: user.id,
          image_cache_id: cacheRow.id,
          storage_path: storagePath,
          width: prepared.width,
          height: prepared.height,
        })
        .select()
        .single()
      if (photoError || !photoRow) throw photoError ?? new Error('Failed to attach photo')

      if (isPrimary) {
        // Inserting straight in as primary would violate the one-primary-
        // per-item unique index whenever another photo already holds it.
        // The RPC atomically unsets the old primary first.
        const { error: primaryError } = await supabase.rpc('set_primary_collection_item_photo', {
          p_photo_id: photoRow.id,
        })
        if (primaryError) throw primaryError
        photoRow.is_primary = true
      }

      return photoRow as CollectionItemImage
    },
    onError: (error, vars) => {
      reportError({
        context: 'useUploadCollectionItemPhoto',
        error,
        metadata: { collectionItemId, isPrimary: vars.isPrimary },
      })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: photosQueryKey(collectionItemId) })
      qc.invalidateQueries({ queryKey: primaryPhotoQueryKey(collectionItemId) })
    },
  })
}

export function useDeleteCollectionItemPhoto(collectionItemId: string) {
  const qc = useQueryClient()
  const queryKey = photosQueryKey(collectionItemId)

  return useMutation({
    mutationFn: async (photo: CollectionItemImage) => {
      const supabase = getSupabase()
      const { error: removeError } = await supabase.storage
        .from('images')
        .remove([photo.storage_path])
      if (removeError) throw removeError

      const { error } = await supabase.from('collection_item_images').delete().eq('id', photo.id)
      if (error) throw error
    },
    onMutate: async (photo) => {
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<CollectionItemImage[]>(queryKey)
      if (prev) {
        qc.setQueryData(
          queryKey,
          prev.filter((p) => p.id !== photo.id)
        )
      }
      return { prev }
    },
    onError: (error, photo, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev)
      reportError({
        context: 'useDeleteCollectionItemPhoto',
        error,
        metadata: { collectionItemId, photoId: photo.id },
      })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: primaryPhotoQueryKey(collectionItemId) })
    },
  })
}

export function useSetPrimaryCollectionItemPhoto(collectionItemId: string) {
  const qc = useQueryClient()
  const queryKey = photosQueryKey(collectionItemId)

  return useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await getSupabase().rpc('set_primary_collection_item_photo', {
        p_photo_id: photoId,
      })
      if (error) throw error
    },
    onMutate: async (photoId) => {
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<CollectionItemImage[]>(queryKey)
      if (prev) {
        qc.setQueryData(
          queryKey,
          prev.map((p) => ({ ...p, is_primary: p.id === photoId }))
        )
      }
      return { prev }
    },
    onError: (error, photoId, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev)
      reportError({
        context: 'useSetPrimaryCollectionItemPhoto',
        error,
        metadata: { collectionItemId, photoId },
      })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: primaryPhotoQueryKey(collectionItemId) })
    },
  })
}
