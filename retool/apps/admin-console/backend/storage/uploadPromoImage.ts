/**
 * Uploads a promo hero image through the promo-asset-upload edge function, which decodes the
 * base64 and writes to the promo-assets bucket with the admin's own session (storage policies
 * allow editors only). Sent as JSON because binary request bodies are unreliable here.
 */
type Params = {
  accessToken: string
  promoId?: string | null
  contentType: string
  dataBase64: string
}

type UploadResponse = { path?: string; public_url?: string; error?: string; msg?: string; message?: string }

export default async function (req: { params: Params }) {
  const { accessToken, promoId, contentType, dataBase64 } = req.params
  if (!dataBase64) return { ok: false as const, message: 'Choose an image first.' }
  try {
    const res = await cardManiaStaging.rawRequest<UploadResponse>({
      path: '/functions/v1/promo-asset-upload',
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      bodyType: 'json',
      body: { promo_id: promoId ?? null, content_type: contentType, data_base64: dataBase64 },
    })
    const data = res.data
    if (!data || !data.path) {
      return { ok: false as const, message: data?.error || data?.msg || data?.message || 'Upload failed.' }
    }
    return { ok: true as const, data: { path: data.path, publicUrl: data.public_url ?? null } }
  } catch (err) {
    return { ok: false as const, message: err instanceof Error ? err.message : String(err) }
  }
}
