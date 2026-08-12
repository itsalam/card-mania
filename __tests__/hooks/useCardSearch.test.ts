import { act, renderHook, waitFor } from '@testing-library/react-native'

import { useCardSearch } from '@/client/price-charting'
import { getSupabase } from '@/lib/store/client'
import { createWrapper } from '../test-utils'

const mockClient = getSupabase() as any

const VALID_RESPONSE = {
  query: 'char',
  query_hash: 'hash-1',
  results: [
    {
      id: 'card-1',
      score: 0.9,
      source: 'local' as const,
      card: {
        id: 'card-1',
        name: 'Charizard',
        grades_prices: {},
      },
    },
  ],
}

describe('useCardSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockClient.functions.invoke.mockResolvedValue({ data: VALID_RESPONSE, error: null })
  })

  it('does not fire and returns no results for an empty catalog query', async () => {
    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useCardSearch({ q: '' }), { wrapper })

    // give the 250ms debounce + any microtasks a chance to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })

    expect(mockClient.functions.invoke).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  it('debounces rapid input and fires the query only once after it settles', async () => {
    const { wrapper } = createWrapper()
    const { result, rerender } = await renderHook(({ q }) => useCardSearch({ q }), {
      wrapper,
      initialProps: { q: 'c' },
    })

    // Each rerender resets useDebounced's 250ms timer; firing them in quick
    // succession (real timers, no waits between) should collapse to a single
    // eventual query for the final value.
    await rerender({ q: 'ch' })
    await rerender({ q: 'cha' })
    await rerender({ q: 'char' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 2000 })

    expect(mockClient.functions.invoke).toHaveBeenCalledTimes(1)
  })

  it('returns results matching the price-charting/search_cards_blended response shape', async () => {
    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useCardSearch({ q: 'char' }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.pages[0]).toEqual(VALID_RESPONSE)
    expect(result.current.data?.pages[0].results[0]).toMatchObject({
      id: expect.any(String),
      score: expect.any(Number),
      source: expect.stringMatching(/^(local|vendor)$/),
      card: expect.objectContaining({ id: expect.any(String), name: expect.any(String) }),
    })
  })
})
