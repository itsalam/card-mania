import { act, renderHook, waitFor } from '@testing-library/react-native'

import {
  CollectionItemImage,
  photosQueryKey,
  useCollectionItemPhotos,
  useDeleteCollectionItemPhoto,
  useSetPrimaryCollectionItemPhoto,
} from '@/client/collections/photos'
import { getSupabase } from '@/lib/store/client'
import { createWrapper } from '../test-utils'

const mockClient = getSupabase() as any

const COLLECTION_ITEM_ID = 'item-1'

const photo = (overrides: Partial<CollectionItemImage>): CollectionItemImage =>
  ({
    id: 'photo-id',
    collection_item_id: COLLECTION_ITEM_ID,
    image_cache_id: 'cache-1',
    storage_path: 'user-uploads/u/item-1/photo-id.jpg',
    is_primary: false,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as CollectionItemImage

describe('useSetPrimaryCollectionItemPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('flips is_primary onto the target photo optimistically, before the RPC resolves', async () => {
    let resolveRpc: (v: { data: unknown; error: unknown }) => void = () => {}
    mockClient.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      })
    )

    const { client, wrapper } = createWrapper()
    const key = photosQueryKey(COLLECTION_ITEM_ID)
    const photos = [photo({ id: 'a', is_primary: true }), photo({ id: 'b' })]
    client.setQueryData(key, photos)

    const { result } = await renderHook(
      () => useSetPrimaryCollectionItemPhoto(COLLECTION_ITEM_ID),
      { wrapper }
    )

    await act(() => {
      result.current.mutate('b')
    })

    await waitFor(() => {
      const cached = client.getQueryData<CollectionItemImage[]>(key)
      expect(cached?.map((p) => [p.id, p.is_primary])).toEqual([
        ['a', false],
        ['b', true],
      ])
    })

    resolveRpc({ data: null, error: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockClient.rpc).toHaveBeenCalledWith('set_primary_collection_item_photo', {
      p_photo_id: 'b',
    })
  })

  it('rolls back the optimistic flip when the RPC errors', async () => {
    let resolveRpc: (v: { data: unknown; error: unknown }) => void = () => {}
    mockClient.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      })
    )

    const { client, wrapper } = createWrapper()
    const key = photosQueryKey(COLLECTION_ITEM_ID)
    const photos = [photo({ id: 'a', is_primary: true }), photo({ id: 'b' })]
    client.setQueryData(key, photos)

    const { result } = await renderHook(
      () => useSetPrimaryCollectionItemPhoto(COLLECTION_ITEM_ID),
      { wrapper }
    )

    await act(() => {
      result.current.mutate('b')
    })

    await waitFor(() => {
      expect(
        client.getQueryData<CollectionItemImage[]>(key)?.find((p) => p.id === 'b')?.is_primary
      ).toBe(true)
    })

    resolveRpc({ data: null, error: new Error('rpc failed') })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryData<CollectionItemImage[]>(key)).toEqual(photos)
  })
})

describe('useDeleteCollectionItemPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Not part of jest.setup.js's shared client mock (only rpc/from/auth/functions/channel
    // are stubbed there) — extend the same singleton object locally for storage.remove.
    mockClient.storage = { from: jest.fn() }
  })

  it('optimistically removes the photo from the cached list, before storage/db calls resolve', async () => {
    let resolveRemove: (v: { data: unknown; error: unknown }) => void = () => {}
    mockClient.storage.from.mockReturnValue({
      remove: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveRemove = resolve
          })
      ),
    })
    mockClient.from.mockImplementation(() => ({
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }))

    const { client, wrapper } = createWrapper()
    const key = photosQueryKey(COLLECTION_ITEM_ID)
    const target = photo({ id: 'a' })
    const photos = [target, photo({ id: 'b' })]
    client.setQueryData(key, photos)

    const { result } = await renderHook(() => useDeleteCollectionItemPhoto(COLLECTION_ITEM_ID), {
      wrapper,
    })

    await act(() => {
      result.current.mutate(target)
    })

    await waitFor(() => {
      expect(client.getQueryData<CollectionItemImage[]>(key)?.map((p) => p.id)).toEqual(['b'])
    })

    resolveRemove({ data: {}, error: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rolls back the optimistic removal when the storage delete errors', async () => {
    mockClient.storage.from.mockReturnValue({
      remove: jest.fn().mockResolvedValue({ data: null, error: new Error('storage failed') }),
    })
    mockClient.from.mockImplementation(() => ({
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }))

    const { client, wrapper } = createWrapper()
    const key = photosQueryKey(COLLECTION_ITEM_ID)
    const target = photo({ id: 'a' })
    const photos = [target, photo({ id: 'b' })]
    client.setQueryData(key, photos)

    const { result } = await renderHook(() => useDeleteCollectionItemPhoto(COLLECTION_ITEM_ID), {
      wrapper,
    })

    await act(() => {
      result.current.mutate(target)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryData<CollectionItemImage[]>(key)).toEqual(photos)
  })
})

describe('useCollectionItemPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches photos ordered by position then created_at', async () => {
    const photos = [photo({ id: 'a' }), photo({ id: 'b' })]
    const order2 = jest.fn().mockResolvedValue({ data: photos, error: null })
    const order1 = jest.fn(() => ({ order: order2 }))
    const eq = jest.fn(() => ({ order: order1 }))
    const select = jest.fn(() => ({ eq }))
    mockClient.from.mockReturnValue({ select })

    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useCollectionItemPhotos(COLLECTION_ITEM_ID), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(photos)
    expect(mockClient.from).toHaveBeenCalledWith('collection_item_images')
    expect(select).toHaveBeenCalledWith('*')
    expect(eq).toHaveBeenCalledWith('collection_item_id', COLLECTION_ITEM_ID)
    expect(order1).toHaveBeenCalledWith('position', { ascending: true })
    expect(order2).toHaveBeenCalledWith('created_at', { ascending: true })
  })
})
