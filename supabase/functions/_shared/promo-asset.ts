// Validation for promo hero images (ITS-193). Pure functions so they can be unit-tested.

export const PROMO_ASSET_MAX_BYTES = 5 * 1024 * 1024

const TYPES: Record<string, { ext: string; magic: (b: Uint8Array) => boolean }> = {
  'image/png': {
    ext: 'png',
    magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  'image/jpeg': {
    ext: 'jpg',
    magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  'image/webp': {
    ext: 'webp',
    // "RIFF" .... "WEBP"
    magic: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type DecodedAsset = { bytes: Uint8Array; contentType: string; ext: string }

/** Decodes a base64 image (optionally a data: URL) and checks its type, size and magic bytes. */
export function decodePromoAsset(
  contentType: unknown,
  dataBase64: unknown
): { ok: true; asset: DecodedAsset } | { ok: false; error: string } {
  if (typeof dataBase64 !== 'string' || dataBase64.length === 0) {
    return { ok: false, error: 'data_base64 is required' }
  }
  let type = typeof contentType === 'string' ? contentType.toLowerCase() : ''
  let b64 = dataBase64
  const dataUrl = /^data:([\w/+.-]+);base64,(.*)$/s.exec(dataBase64)
  if (dataUrl) {
    type ||= dataUrl[1].toLowerCase()
    b64 = dataUrl[2]
  }
  const spec = TYPES[type]
  if (!spec) return { ok: false, error: 'image must be PNG, JPEG or WebP' }

  // Rough size check before decoding: base64 is 4 chars per 3 bytes.
  if (b64.length > Math.ceil((PROMO_ASSET_MAX_BYTES * 4) / 3) + 4) {
    return { ok: false, error: 'image must be 5 MB or smaller' }
  }
  let bytes: Uint8Array
  try {
    const bin = atob(b64.replace(/\s+/g, ''))
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return { ok: false, error: 'data_base64 is not valid base64' }
  }
  if (bytes.length === 0) return { ok: false, error: 'image is empty' }
  if (bytes.length > PROMO_ASSET_MAX_BYTES)
    return { ok: false, error: 'image must be 5 MB or smaller' }
  if (bytes.length < 12 || !spec.magic(bytes)) {
    return { ok: false, error: `file content is not a ${spec.ext.toUpperCase()} image` }
  }
  return { ok: true, asset: { bytes, contentType: type, ext: spec.ext } }
}

/** Object path for a new upload: promos/<promo id or "unsaved">/<random>.<ext>. */
export function promoAssetPath(
  promoId: unknown,
  ext: string,
  random: string = crypto.randomUUID()
): string {
  const folder =
    typeof promoId === 'string' && UUID_RE.test(promoId) ? promoId.toLowerCase() : 'unsaved'
  return `promos/${folder}/${random}.${ext}`
}
