import { renderHook, waitFor } from '@testing-library/react-native'

import { useActivationStatus } from '@/client/onboarding/activation'
import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { createWrapper } from '../test-utils'

const mockClient = getSupabase() as any

const USER_ID = 'user-1'

describe('useActivationStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useUserStore.setState({ user: { id: USER_ID } as any })
  })

  it('does not fire without a signed-in user', async () => {
    useUserStore.setState({ user: null })
    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useActivationStatus(), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockClient.rpc).not.toHaveBeenCalled()
  })

  it('calls get_activation_status and returns the per-condition + combined result', async () => {
    const single = jest.fn().mockResolvedValue({
      data: {
        has_storefront: false,
        has_collection_item: true,
        has_offer: false,
        activated: true,
      },
      error: null,
    })
    mockClient.rpc.mockReturnValue({ single })

    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useActivationStatus(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockClient.rpc).toHaveBeenCalledWith('get_activation_status')
    expect(result.current.data).toEqual({
      has_storefront: false,
      has_collection_item: true,
      has_offer: false,
      activated: true,
    })
  })

  it('surfaces an RPC error to the caller', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: new Error('rpc failed') })
    mockClient.rpc.mockReturnValue({ single })

    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useActivationStatus(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
