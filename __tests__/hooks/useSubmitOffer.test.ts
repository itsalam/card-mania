import { act, renderHook, waitFor } from '@testing-library/react-native'

import { useSubmitOffer } from '@/client/offers'
import { SubmitOfferPayload } from '@/client/offers/types'
import { getSupabase } from '@/lib/store/client'
import { createWrapper } from '../test-utils'

const mockClient = getSupabase() as any

const PAYLOAD: SubmitOfferPayload = {
  seller_id: 'seller-1',
  items: [{ collection_item_id: 'ci-1', quantity: 1, offered_price_per_unit: 500 }],
}

/** Minimal thenable that mirrors the chainable shape of a Supabase query builder. */
function chain(promise: Promise<{ data: unknown; error: unknown }>) {
  const c: any = {
    select: () => c,
    insert: () => c,
    single: () => promise,
    then: (onFulfilled: any, onRejected?: any) => promise.then(onFulfilled, onRejected),
  }
  return c
}

describe('useSubmitOffer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'buyer-1' } }, error: null })
  })

  it('is pending while the insert is in flight and settles once it resolves', async () => {
    let resolveOffer: (v: { data: unknown; error: unknown }) => void = () => {}
    const offerPromise = new Promise<{ data: unknown; error: unknown }>((resolve) => {
      resolveOffer = resolve
    })
    mockClient.from.mockImplementation((table: string) =>
      table === 'offers' ? chain(offerPromise) : chain(Promise.resolve({ data: [], error: null }))
    )

    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useSubmitOffer(), { wrapper })

    expect(result.current.isPending).toBe(false)

    await act(() => {
      result.current.mutate(PAYLOAD)
    })

    await waitFor(() => expect(result.current.isPending).toBe(true))

    resolveOffer({ data: { id: 'offer-1' }, error: null })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.isPending).toBe(false)
  })

  it('a caller gating on isPending cannot double-submit while a mutation is in flight', async () => {
    let resolveOffer: (v: { data: unknown; error: unknown }) => void = () => {}
    const offerPromise = new Promise<{ data: unknown; error: unknown }>((resolve) => {
      resolveOffer = resolve
    })
    mockClient.from.mockImplementation((table: string) =>
      table === 'offers' ? chain(offerPromise) : chain(Promise.resolve({ data: [], error: null }))
    )

    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useSubmitOffer(), { wrapper })

    const trySubmit = () => {
      if (!result.current.isPending) result.current.mutate(PAYLOAD)
    }

    await act(() => trySubmit())
    await waitFor(() => expect(result.current.isPending).toBe(true))

    // Guarded second attempt while pending — must be a no-op.
    await act(() => trySubmit())

    resolveOffer({ data: { id: 'offer-1' }, error: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Exactly one submission's worth of table writes (offers + offer_items).
    expect(mockClient.from).toHaveBeenCalledTimes(2)
  })

  it('surfaces the error to the caller via onError without throwing', async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('not authenticated'),
    })

    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useSubmitOffer(), { wrapper })
    const onError = jest.fn()

    await act(() => {
      result.current.mutate(PAYLOAD, { onError })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe('not authenticated')
    expect(mockClient.from).not.toHaveBeenCalled()
  })
})
