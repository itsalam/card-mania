import { CollectionItemImage } from '@/client/collections/photos'
import { buildThumbCacheKey, orderCarouselPhotos } from '@/features/tcg-card-views/helpers'

const photo = (overrides: Partial<CollectionItemImage>): CollectionItemImage =>
  ({
    id: 'photo-id',
    collection_item_id: 'item-1',
    image_cache_id: 'cache-1',
    storage_path: 'path',
    is_primary: false,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as CollectionItemImage

describe('buildThumbCacheKey', () => {
  it('prefers queryHash over imageId and cardId', () => {
    expect(buildThumbCacheKey({ queryHash: 'hash-1', imageId: 'image-1', cardId: 'card-1' })).toBe(
      'hash-1-thumb'
    )
  })

  it('falls back to imageId when queryHash is absent', () => {
    expect(buildThumbCacheKey({ imageId: 'image-1', cardId: 'card-1' })).toBe('image-1-thumb')
  })

  it('falls back to cardId when neither queryHash nor imageId are present', () => {
    expect(buildThumbCacheKey({ cardId: 'card-1' })).toBe('card-1-thumb')
  })

  // Regression guard: card-image.tsx's list-tile thumbnail and DetailCardView's hero
  // placeholder must resolve to the identical cacheKey for the same photo, or expo-image
  // treats them as different images and can't reuse the list tile's already-warm cache
  // entry for the detail view's placeholder.
  it('produces the same key for the same imageProxyArgs regardless of caller', () => {
    const args = { imageId: 'image-1', cardId: 'card-1', queryHash: undefined }
    expect(buildThumbCacheKey(args)).toBe(buildThumbCacheKey({ ...args }))
  })
})

describe('orderCarouselPhotos', () => {
  it('returns an empty array unchanged', () => {
    expect(orderCarouselPhotos([])).toEqual([])
  })

  it('leaves the order unchanged when the primary photo is already first', () => {
    const photos = [photo({ id: 'a', is_primary: true }), photo({ id: 'b' })]
    expect(orderCarouselPhotos(photos).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('leaves the order unchanged when no photo is primary', () => {
    const photos = [photo({ id: 'a' }), photo({ id: 'b' }), photo({ id: 'c' })]
    expect(orderCarouselPhotos(photos).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('moves the primary photo to the front, preserving the relative order of the rest', () => {
    const photos = [
      photo({ id: 'a' }),
      photo({ id: 'b' }),
      photo({ id: 'c', is_primary: true }),
      photo({ id: 'd' }),
    ]
    expect(orderCarouselPhotos(photos).map((p) => p.id)).toEqual(['c', 'a', 'b', 'd'])
  })
})
