import { getDefaultCardPlaceholderSource } from '@/components/tcg-card/placeholders'
import { getSupabase } from '@/lib/store/client'

// getDefaultCardPlaceholderSource itself doesn't touch Spinner (only CardPlaceholderImage/
// LoadingImagePlaceholder, this file's other exports, do) — mocked purely because the real
// components/ui/spinner drags in @gluestack-ui/nativewind-utils/tva, native ESM Jest can't parse,
// same class of issue as jest.setup.js's existing @/components/Toast mock. jest.mock calls are
// hoisted above imports by babel-jest regardless of where they're written, so this still applies
// before the import above actually evaluates.
jest.mock('@/components/ui/spinner', () => ({ Spinner: () => null }))

// Not part of jest.setup.js's shared client mock (only rpc/from/auth/functions/channel are
// stubbed there) — extend the same singleton object locally, matching
// __tests__/client/collectionItemPhotos.test.ts's pattern for storage.
const mockClient = getSupabase() as any

describe('getDefaultCardPlaceholderSource', () => {
  let getPublicUrl: jest.Mock
  let from: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    getPublicUrl = jest
      .fn()
      .mockReturnValue({ data: { publicUrl: 'https://cdn.test/default.png' } })
    from = jest.fn().mockReturnValue({ getPublicUrl })
    mockClient.storage = { from }
  })

  it('requests the "placeholder" bucket\'s default.png', () => {
    getDefaultCardPlaceholderSource(96, 134)

    expect(from).toHaveBeenCalledWith('placeholder')
    expect(getPublicUrl).toHaveBeenCalledWith(
      'default.png',
      expect.objectContaining({ transform: expect.any(Object) })
    )
  })

  it('passes resize/quality plus the rounded target dimensions as transform params', () => {
    getDefaultCardPlaceholderSource(96, 134)

    expect(getPublicUrl).toHaveBeenCalledWith('default.png', {
      transform: { resize: 'cover', quality: 100, width: 96, height: 134 },
    })
  })

  it('rounds non-integer width/height before building the transform params and cacheKey', () => {
    const result = getDefaultCardPlaceholderSource(95.6, 133.4)

    expect(getPublicUrl).toHaveBeenCalledWith('default.png', {
      transform: { resize: 'cover', quality: 100, width: 96, height: 133 },
    })
    expect(result.cacheKey).toBe('card-placeholder-96x133')
  })

  it('returns the resolved publicUrl as uri, paired with a size-derived cacheKey', () => {
    const result = getDefaultCardPlaceholderSource(96, 134)

    expect(result).toEqual({
      uri: 'https://cdn.test/default.png',
      cacheKey: 'card-placeholder-96x134',
    })
  })

  it('produces different cacheKeys for different sizes, so distinct dimensions never collide', () => {
    const small = getDefaultCardPlaceholderSource(96, 134)
    const large = getDefaultCardPlaceholderSource(300, 420)

    expect(small.cacheKey).not.toBe(large.cacheKey)
  })
})
