import { availableQuantity, isListedRow, listingPrice } from '@/client/collections/listing'

describe('listingPrice (ITS-134)', () => {
  it('uses the asking price when the seller set one', () => {
    expect(listingPrice({ asking_price_cents: 4500, market_value: 5000 })).toEqual({
      cents: 4500,
      isAsking: true,
    })
  })

  it('falls back to the market price for older listings', () => {
    expect(listingPrice({ asking_price_cents: null, market_value: 5000 })).toEqual({
      cents: 5000,
      isAsking: false,
    })
    expect(listingPrice({ market_value: null })).toEqual({ cents: 0, isAsking: false })
  })
})

describe('availableQuantity (ITS-135)', () => {
  it('leaves out copies on hold', () => {
    expect(availableQuantity({ quantity: 3, held_quantity: 1 })).toBe(2)
    expect(availableQuantity({ quantity: 1, held_quantity: 1 })).toBe(0)
    expect(availableQuantity({ quantity: 2 })).toBe(2)
  })
})

describe('isListedRow', () => {
  it('is true for a storefront listing or any of its mirrors', () => {
    expect(isListedRow({ mirror_of: 'x' })).toBe(true)
    expect(isListedRow({ mirror_of: null }, { is_storefront: true })).toBe(true)
    expect(isListedRow({ mirror_of: null }, { is_storefront: false })).toBe(false)
  })
})
