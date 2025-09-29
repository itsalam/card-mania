import { useQuery } from '@tanstack/react-query'
import { invokeFx } from '../helper'

type CdnVariant = 'raw' | 'tiny' | 'thumb' | 'detail' | 'full'
type CdnShape = 'original' | 'card' | 'square'
type CdnFit = 'cover' | 'contain' // 'cover' crops to fill; 'contain' letterboxes

type CdnOpts = {
  variant?: CdnVariant // preset size
  shape?: CdnShape // force aspect if not 'original'
  fit?: CdnFit // default cover for 'card', contain for 'square'
  width?: number // override preset width
  height?: number // override preset height
  quality?: number // default depends on variant
  bucket?: string // default "images"
}

type CdnKeys = {
  queryHash?: string
  imageId?: string
  cardId?: string
  kind?: 'front' | 'back' | 'extra'
}

type ImageProxyOpts = CdnOpts & CdnKeys

export function useImageProxy(cdnOpts: ImageProxyOpts) {
  const { imageId, cardId, kind, queryHash, ...xform } = cdnOpts;
  const enabled = Boolean(imageId ?? (cardId && kind) ?? queryHash);

  // include **all** options that affect the resulting URL in the queryKey:
  const key = ['image-proxy', { imageId, cardId, kind, queryHash, ...xform }];

  // build query string for the proxy in JSON mode
  const payload = {
    ...(imageId ? { image_id: imageId } : {}),
    ...(cardId && kind ? { card_id: cardId, kind } : {}),
    ...(queryHash ? { query_hash: queryHash } : {}),
    ...(xform.variant ? { variant: xform.variant } : {}),
    ...(xform.shape ? { shape: xform.shape } : {}),
    ...(xform.fit ? { fit: xform.fit } : {}),
    ...(xform.width ? { width: String(xform.width) } : {}),
    ...(xform.height ? { height: (xform.height) } : {}),
    ...(xform.quality ? { quality: String(xform.quality) } : {}),
    ...(xform.bucket ? { bucket: xform.bucket } : {}),
  } as Partial<ImageProxyOpts>

  // pick staleTime based on addressing mode
  const isStable = Boolean(imageId); // content-addressed → stable
  const staleTime = isStable ? 10 * 60 * 1000 : 60 * 1000; // 10m vs 1m

  return useQuery({
    queryKey: key,
    enabled: enabled,
    queryFn: async () => {
      const proxyRes = await invokeFx<
        ImageProxyOpts,
        { status: string; url: string }
      >(
        'image-proxy',
        payload,
        { method: 'GET', useQueryParams: true, headers: { 'x-internal': '1', 'Accept': 'application/json' } }
      )
      return proxyRes.data.url
    },
    select: (url) => url,
    staleTime,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: !isStable, // for query_hash mode, let it refresh
    retry: 1,
  })
}
