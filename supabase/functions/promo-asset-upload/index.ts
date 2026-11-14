// promo-asset-upload: uploads a promo hero image to the promo-assets bucket (ITS-193).
//
// The Retool admin console can't reliably send binary bodies, so it sends JSON:
//   POST { "content_type": "image/png", "data_base64": "...", "promo_id": "<uuid, optional>" }
//   Authorization: Bearer <the admin's own Supabase access token>
// → 200 { "path": "promos/<id>/<uuid>.png", "public_url": "..." }
//
// The upload runs with the caller's own session (anon key + their token), never the service key,
// so the bucket's storage policies decide who may write: editors and owners only
// (20261114000000_its191_promo_boxes.sql). This function only decodes and validates the image.
import { decodePromoAsset, promoAssetPath } from '@promo-asset'
import { createSupabaseClient, json } from '@utils'
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const BUCKET = 'promo-assets'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, { status: 405 })
  if (!req.headers.get('Authorization')?.startsWith('Bearer ')) {
    return json({ error: 'sign in first' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'body must be JSON' }, { status: 400 })

  const decoded = decodePromoAsset(body.content_type, body.data_base64)
  if (!decoded.ok) return json({ error: decoded.error }, { status: 400 })
  const { bytes, contentType, ext } = decoded.asset

  const userClient = createSupabaseClient(req)
  const path = promoAssetPath(body.promo_id, ext)
  const { error } = await userClient.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) {
    const message = error.message ?? String(error)
    const denied = /row-level security|unauthorized|not authorized|jwt/i.test(message)
    return json(
      { error: denied ? 'not authorized: only editors can upload promo images' : message },
      { status: denied ? 403 : 500 }
    )
  }

  const publicUrl = userClient.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  return json({ path, public_url: publicUrl })
})
