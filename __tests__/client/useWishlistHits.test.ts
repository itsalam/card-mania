import { renderHook, waitFor } from '@testing-library/react-native'

import { tickerName, useTickerItems } from '@/client/home/ticker'
import { getSavings, listingRoute, useWishlistHits } from '@/client/wishlist/hits'
import { getSupabase } from '@/lib/store/client'
import { useUserStore } from '@/lib/store/useUserStore'
import { createWrapper } from '../test-utils'

const mockClient = getSupabase() as any

describe('useWishlistHits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useUserStore.setState({ user: { id: 'user-1' } as any })
  })

  it('calls get_wishlist_hits with the limit and returns rows', async () => {
    mockClient.rpc.mockResolvedValue({ data: [{ listing_item_id: 'l1' }], error: null })
    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useWishlistHits(5), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockClient.rpc).toHaveBeenCalledWith('get_wishlist_hits', { p_limit: 5 })
    expect(result.current.data).toEqual([{ listing_item_id: 'l1' }])
  })

  it('surfaces RPC errors', async () => {
    mockClient.rpc.mockResolvedValue({ data: null, error: new Error('boom') })
    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useWishlistHits(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('does not query when signed out', async () => {
    useUserStore.setState({ user: null } as any)
    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useWishlistHits(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockClient.rpc).not.toHaveBeenCalled()
  })
})

describe('getSavings', () => {
  it('reports savings only when the price dropped since wishlisting', () => {
    expect(getSavings({ current_price_cents: 600, snapshot_price_cents: 800 })).toEqual({
      pct: 25,
      compareAt: 800,
    })
    expect(getSavings({ current_price_cents: 900, snapshot_price_cents: 800 })).toBeNull()
    expect(getSavings({ current_price_cents: 800, snapshot_price_cents: 800 })).toBeNull()
    expect(getSavings({ current_price_cents: 600, snapshot_price_cents: null })).toBeNull()
  })
})

describe('listingRoute', () => {
  it('targets the shop-item route with card + collection params', () => {
    expect(
      listingRoute({ listing_item_id: 'l1', ref_id: 'c1', listing_collection_id: 'col1' })
    ).toEqual({
      pathname: '/profile/[shop-item]',
      params: { 'shop-item': 'l1', cardId: 'c1', collectionId: 'col1' },
    })
  })
})

describe('useTickerItems', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useUserStore.setState({ user: { id: 'user-1' } as any })
  })

  it('calls get_ticker_items with a 7-day window', async () => {
    mockClient.rpc.mockResolvedValue({ data: [], error: null })
    const { wrapper } = createWrapper()
    const { result } = await renderHook(() => useTickerItems(12), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockClient.rpc).toHaveBeenCalledWith('get_ticker_items', { p_limit: 12, p_days: 7 })
  })

  it('tickerName drops variation brackets and card numbers', () => {
    expect(tickerName('Shohei Ohtani [Black Big Head Variation] #1')).toBe('Shohei Ohtani')
    expect(tickerName(null)).toBe('Card')
  })
})
