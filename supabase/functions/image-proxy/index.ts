// /functions/image_proxy/index.ts
import { createClient } from '@supabase/supabase-js'
import { CardImageFields, CdnFit, CdnOpts, CdnShape, CdnVariant } from '@types'
import { getImageCacheFromQueryHash } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Database } from '../_shared/supabase.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DEBUG = (Deno.env.get('DEBUG') ?? 'false').toLowerCase() === 'true'
const dbg = (...args: unknown[]) => {
  if (DEBUG) console.debug(...args)
}
const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE)

// constants for trading cards: 63mm x 88mm  => H/W ≈ 1.396825
const CARD_AR = 88 / 63 // ≈ 1.396825

type ImageShape = 'card' | 'slab' | 'unknown'

/**
 * Classify an image as a standard trading card, a graded slab, or unknown
 * based on its stored pixel dimensions.
 *
 * Standard card H/W ≈ 1.397  (63 × 88 mm)
 * Graded slabs (PSA/SGC) H/W ≈ 1.50–1.52 — measurably taller than a raw card
 * Tolerance of 8% around CARD_AR catches minor scan/crop variations.
 */
function classifyImageShape(width: number | null, height: number | null): ImageShape {
  if (!width || !height || width <= 0 || height <= 0) return 'unknown'
  const ar = height / width
  if (Math.abs(ar - CARD_AR) / CARD_AR <= 0.08) return 'card'
  if (ar > CARD_AR * 1.08) return 'slab'
  return 'unknown'
}

/** W/H pixel aspect ratio from stored dimensions; null when dimensions are unavailable. */
function pixelAspectRatio(width: number | null, height: number | null): number | null {
  return width && height && width > 0 && height > 0 ? width / height : null
}

// Helper to compute W×H given shape + desired width
function dimsFor(
  opts: Required<Pick<CdnOpts, 'shape' | 'fit'>> & Pick<CdnOpts, 'width' | 'height' | 'variant'>
) {
  dbg('Computing dimensions for options:', opts)

  // sensible defaults per variant
  const presetWidth: Record<CdnVariant, number> = {
    raw: 0,
    tiny: 120,
    thumb: 320,
    detail: 768,
    full: 1280,
  }

  const w = opts.width ?? presetWidth[opts.variant ?? 'thumb']
  let width = w
  let height = opts.height ?? 0

  if (opts.shape === 'card') {
    // If caller set height explicitly, trust it; else compute exact card ratio
    if (!height && width) height = Math.round(width * CARD_AR)
  } else if (opts.shape === 'square') {
    if (!height && width) height = width
  } else {
    // original: leave height unset to let the CDN keep natural aspect
    width = width || 0
    height = height || 0
  }

  dbg('Computed dimensions:', { width, height })
  return { width, height }
}

function qualityFor(variant: CdnVariant | undefined) {
  dbg('Getting quality for variant:', variant)

  switch (variant) {
    case 'tiny':
      return 70
    case 'thumb':
      return 80
    case 'detail':
      return 85
    case 'full':
      return 90
    default:
      return 80
  }
}

/**
 * Build a public CDN URL for a stored image with optional transform
 * - If shape === 'card', enforces trading-card aspect (63x88) using cover/contain.
 * - Prefer a small set of preset sizes for great CDN cache hit rates.
 */
function cdnUrl(
  storagePath: string,
  {
    variant = 'thumb',
    shape = 'original',
    fit,
    width,
    height,
    quality,
    bucket = 'images',
  }: CdnOpts = {}
) {
  dbg('Building CDN URL for:', {
    storagePath,
    variant,
    shape,
    fit,
    width,
    height,
    quality,
    bucket,
  })

  if (variant === 'raw' || (shape === 'original' && !width && !height)) {
    const url = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
    dbg('Generated raw URL:', url)
    return url
  }

  // Defaults: card → cover; square → contain; original → cover (if both dims given)
  const resize: CdnFit =
    fit ?? (shape === 'card' ? 'cover' : shape === 'square' ? 'contain' : 'cover')

  const { width: w, height: h } = dimsFor({
    shape,
    fit: resize,
    width,
    height,
    variant,
  })
  const q = quality ?? qualityFor(variant)

  // Supabase transform: { resize, width?, height?, quality? }
  // (Avoid specifying width/height = 0; only include when > 0)
  const transform: any = { resize, quality: q }
  if (w && w > 0) transform.width = w
  if (h && h > 0) transform.height = h

  dbg('Transform parameters:', transform)

  const url = supabase.storage.from(bucket).getPublicUrl(storagePath, { transform }).data.publicUrl
  dbg('Generated transformed URL:', url)
  return url
}

function json(data: unknown, init: ResponseInit = {}) {
  dbg('Creating JSON response:', { data, init })
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
}

Deno.serve(async (req) => {
  const startTime = Date.now()
  const url = new URL(req.url)
  const imageId = url.searchParams.get('image_id')
  const cardId = url.searchParams.get('card_id')
  const kind = url.searchParams.get('kind') as 'front' | 'back' | 'extra' | null
  const variant = (url.searchParams.get('variant') as CdnVariant) || 'full'
  const shape = (url.searchParams.get('shape') as CdnShape) || 'original'
  const fit = (url.searchParams.get('fit') as CdnFit) || 'cover'
  const width = url.searchParams.get('width') ? parseInt(url.searchParams.get('width')!) : undefined
  const height = url.searchParams.get('height')
    ? parseInt(url.searchParams.get('height')!)
    : undefined
  const quality = url.searchParams.get('quality')
    ? parseInt(url.searchParams.get('quality')!)
    : undefined
  const bucket = url.searchParams.get('bucket') || 'images'
  const internal = req.headers.get('x-internal') === '1'
  const queryHash = url.searchParams.get('query_hash') // candidate mode
  const externalUrl = url.searchParams.get('url') // raw fallback

  try {
    let storagePath: string | null = null
    let dims: { width: number | null; height: number | null } = { width: null, height: null }

    if (imageId) {
      dbg('Serving by image_cache.id:', imageId)
      const { data, error } = await supabase
        .from('image_cache')
        .select('storage_path, width, height')
        .eq('id', imageId)
        .maybeSingle()
      if (error) throw error
      storagePath = data?.storage_path ?? null
      dims = { width: data?.width ?? null, height: data?.height ?? null }
    }
    if (!storagePath && cardId && kind) {
      dbg('Serving by card binding:', { cardId, kind })
      const { data, error } = await supabase
        .from('card_images')
        .select('image_cache(storage_path, width, height)')
        .eq('card_id', cardId)
        .eq('kind', kind)
        .maybeSingle()
      if (error) throw error
      storagePath = data?.image_cache?.storage_path ?? null
      dims = {
        width: data?.image_cache?.width ?? null,
        height: data?.image_cache?.height ?? null,
      }
    }
    if (!storagePath && queryHash) {
      const { ic, isc } = await getImageCacheFromQueryHash(queryHash, supabase)
      dbg('Serving by query hash:', queryHash)

      if (ic?.storage_path) {
        const cdn = cdnUrl(ic.storage_path, {
          variant,
          shape,
          fit,
          width,
          height,
          quality,
          bucket,
        })
        if (internal) {
          return json(
            {
              url: cdn,
              status: 'READY',
              shape: classifyImageShape(ic.width, ic.height),
              aspectRatio: pixelAspectRatio(ic.width, ic.height),
            },
            {
              headers: { 'cache-control': 'no-store' },
            }
          )
        }
        return new Response(null, {
          status: 302,
          headers: { Location: cdn },
        })
      } else if (isc) {
        console.log('image not commited yet, committing to card_images')
        // Likely have to create a way to determine when to add requested images
        const cardFields: Partial<CardImageFields> = {
          card_id: cardId,
          kind: kind,
          status: 'READY',
          width: width ?? null,
          height: height ?? null,
        }
        EdgeRuntime.waitUntil(
          supabase.functions
            .invoke('image-commit', {
              method: 'POST',
              body: { query_hash: queryHash, card_fields: cardFields },
            })
            .catch((e) => {
              console.error('Image commit failed:', isc, e)
            })
        )
      }

      console.log('No cache/candidate found, returning fallback')
      if (internal) {
        return returnInteralFallback({
          variant,
          shape,
          fit,
          width,
          height,
          quality,
          bucket: 'placeholder',
        })
      }
      return returnExternalFallback({
        variant,
        shape,
        fit,
        width,
        height,
        quality,
        bucket: 'placeholder',
      })
    }

    if (storagePath) {
      dbg('Found storage path:', storagePath)
      const cdn = cdnUrl(storagePath, {
        variant,
        shape,
        fit,
        width,
        height,
        quality,
        bucket,
      })
      if (internal) {
        return json(
          {
            url: cdn,
            status: 'READY',
            shape: classifyImageShape(dims.width, dims.height),
            aspectRatio: pixelAspectRatio(dims.width, dims.height),
          },
          {
            headers: { 'cache-control': 'no-store' },
          }
        )
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: cdn,
          'cache-control': 'public, max-age=60, s-maxage=86400, stale-while-revalidate=604800',
        },
      })
    }

    console.log('No stored image found, returning placeholder')
    if (internal) {
      return returnInteralFallback({
        variant,
        shape,
        fit,
        width,
        height,
        quality,
        bucket,
      })
    }
    return returnExternalFallback({
      variant,
      shape,
      fit,
      width,
      height,
      quality,
      bucket,
    })
  } catch (err) {
    console.error('Image proxy error:', err)
    return json({ error: 'Proxy failure' }, { status: 500 })
  } finally {
    const duration = Date.now() - startTime
    console.log(`Request completed in ${duration}ms`)
  }
})

const returnInteralFallback = (opts: CdnOpts) => {
  dbg('Returning internal fallback with options:', opts)
  const { variant, shape, fit, width, height, quality } = opts
  const fallback = cdnUrl('default.png', {
    variant,
    shape,
    fit,
    width,
    height,
    quality,
    bucket: 'placeholder',
  })
  return json({
    url: fallback,
    status: 'FALLBACK',
    shape: 'unknown' as ImageShape,
    aspectRatio: null,
  })
}

const returnExternalFallback = (opts: CdnOpts) => {
  dbg('Returning external fallback with options:', opts)
  const { variant, shape, fit, width, height, quality } = opts
  const fallback = cdnUrl('default.png', {
    variant,
    shape,
    fit,
    width,
    height,
    quality,
    bucket: 'placeholder',
  })
  return new Response(null, { status: 302, headers: { Location: fallback } })
}
