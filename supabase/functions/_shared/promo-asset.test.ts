import { assertEquals } from 'jsr:@std/assert'
import { decodePromoAsset, PROMO_ASSET_MAX_BYTES, promoAssetPath } from './promo-asset.ts'

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes))
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1, 2, 3]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]

Deno.test('accepts PNG, JPEG and WebP with matching content', () => {
  for (const [type, bytes, ext] of [
    ['image/png', PNG, 'png'],
    ['image/jpeg', JPEG, 'jpg'],
    ['image/webp', WEBP, 'webp'],
  ] as const) {
    const res = decodePromoAsset(type, b64([...bytes]))
    assertEquals(res.ok, true, type)
    if (res.ok) {
      assertEquals(res.asset.ext, ext)
      assertEquals(res.asset.bytes.length, bytes.length)
    }
  }
})

Deno.test('reads the type from a data URL', () => {
  const res = decodePromoAsset(undefined, `data:image/png;base64,${b64(PNG)}`)
  assertEquals(res.ok, true)
})

Deno.test('rejects other types, mismatched content, bad base64 and oversize files', () => {
  assertEquals(decodePromoAsset('image/gif', b64(PNG)), {
    ok: false,
    error: 'image must be PNG, JPEG or WebP',
  })
  assertEquals(decodePromoAsset('image/png', b64(JPEG)), {
    ok: false,
    error: 'file content is not a PNG image',
  })
  assertEquals(decodePromoAsset('image/png', '!!!not base64'), {
    ok: false,
    error: 'data_base64 is not valid base64',
  })
  assertEquals(decodePromoAsset('image/png', ''), { ok: false, error: 'data_base64 is required' })
  const big = 'A'.repeat(Math.ceil((PROMO_ASSET_MAX_BYTES * 4) / 3) + 100)
  assertEquals(decodePromoAsset('image/png', big), {
    ok: false,
    error: 'image must be 5 MB or smaller',
  })
})

Deno.test('paths are scoped to the promo, or "unsaved"', () => {
  assertEquals(
    promoAssetPath('7F0C0E2A-1111-4222-8333-444455556666', 'png', 'r'),
    'promos/7f0c0e2a-1111-4222-8333-444455556666/r.png'
  )
  assertEquals(promoAssetPath('../../etc', 'jpg', 'r'), 'promos/unsaved/r.jpg')
  assertEquals(promoAssetPath(undefined, 'webp', 'r'), 'promos/unsaved/r.webp')
})
