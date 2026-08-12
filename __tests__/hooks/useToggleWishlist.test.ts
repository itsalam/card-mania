import { act, renderHook, waitFor } from '@testing-library/react-native'

import { useToggleWishlist } from '@/client/card/wishlist'
import { getSupabase } from '@/lib/store/client'
import { qk } from '@/lib/store/functions/helpers'
import { useUserStore } from '@/lib/store/useUserStore'
import { createWrapper } from '../test-utils'

const mockClient = getSupabase() as any

const USER_ID = 'user-1'

describe('useToggleWishlist', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useUserStore.setState({ user: { id: USER_ID } as any })
  })

  it('flips the id into the wishlist cache optimistically on press, before the mutation resolves', async () => {
    let resolveRpc: (v: unknown) => void = () => {}
    mockClient.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      })
    )

    const { client, wrapper } = createWrapper()
    const key = qk.wishlist('card', USER_ID)
    client.setQueryData(key, new Set<string>())

    const { result } = await renderHook(() => useToggleWishlist('card'), { wrapper })

    await act(() => {
      result.current.mutate({ kind: 'card', id: 'card-1' })
    })

    await waitFor(() => {
      expect(client.getQueryData(key)).toEqual(new Set(['card-1']))
    })

    resolveRpc({ data: [{ is_wishlisted: true }], error: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rolls back the optimistic flip when the mutation errors', async () => {
    // A deferred (not pre-resolved) promise lets us observe the optimistic
    // flip before the mutation settles — a mock that resolves immediately
    // can flip-and-roll-back within microtasks, faster than any poll can see.
    let resolveRpc: (v: unknown) => void = () => {}
    mockClient.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      })
    )

    const { client, wrapper } = createWrapper()
    const key = qk.wishlist('card', USER_ID)
    client.setQueryData(key, new Set<string>())

    const { result } = await renderHook(() => useToggleWishlist('card'), { wrapper })

    await act(() => {
      result.current.mutate({ kind: 'card', id: 'card-1' })
    })

    await waitFor(() => expect(client.getQueryData(key)).toEqual(new Set(['card-1'])))

    resolveRpc({ data: null, error: new Error('rpc failed') })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryData(key)).toEqual(new Set())
  })

  it('reconciles the cache with the server response on success', async () => {
    // Server disagrees with the optimistic flip (id ends up NOT wishlisted).
    let resolveRpc: (v: unknown) => void = () => {}
    mockClient.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      })
    )

    const { client, wrapper } = createWrapper()
    const key = qk.wishlist('card', USER_ID)
    client.setQueryData(key, new Set<string>())

    const { result } = await renderHook(() => useToggleWishlist('card'), { wrapper })

    await act(() => {
      result.current.mutate({ kind: 'card', id: 'card-1' })
    })

    await waitFor(() => expect(client.getQueryData(key)).toEqual(new Set(['card-1'])))

    resolveRpc({ data: [{ is_wishlisted: false }], error: null })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryData(key)).toEqual(new Set())
  })
})
