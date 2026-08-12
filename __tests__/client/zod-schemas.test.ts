import { OfferItem } from '@/client/offers/types'
import { ShippingAddress } from '@/client/transactions/types'

describe('OfferItem schema', () => {
  const valid = {
    id: '11111111-1111-4111-8111-111111111111',
    offer_id: '22222222-2222-4222-8222-222222222222',
    collection_item_id: '33333333-3333-4333-8333-333333333333',
    quantity: 2,
    offered_price_per_unit: 500,
    card_snapshot: { title: 'Charizard', listing_price: 1999 },
  }

  it('accepts a valid offer item payload', () => {
    const result = OfferItem.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('accepts a null collection_item_id and card_snapshot', () => {
    const result = OfferItem.safeParse({ ...valid, collection_item_id: null, card_snapshot: null })
    expect(result.success).toBe(true)
  })

  it('rejects a non-uuid id with a typed error on the offending field', () => {
    const result = OfferItem.safeParse({ ...valid, id: 'not-a-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'id')).toBe(true)
    }
  })

  it('rejects a zero/negative quantity', () => {
    const result = OfferItem.safeParse({ ...valid, quantity: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'quantity')).toBe(true)
    }
  })

  it('rejects a non-integer quantity', () => {
    const result = OfferItem.safeParse({ ...valid, quantity: 1.5 })
    expect(result.success).toBe(false)
  })

  it('rejects a payload missing a required field', () => {
    const { offered_price_per_unit: _drop, ...missingField } = valid
    const result = OfferItem.safeParse(missingField)
    expect(result.success).toBe(false)
  })
})

describe('ShippingAddress schema', () => {
  const valid = {
    street: '123 Main St',
    city: 'Toronto',
    state: 'ON',
    postal_code: 'M5V 2T6',
    country: 'CA',
  }

  it('accepts a valid address, with `apt` optional', () => {
    expect(ShippingAddress.safeParse(valid).success).toBe(true)
    expect(ShippingAddress.safeParse({ ...valid, apt: '4B' }).success).toBe(true)
  })

  it('rejects a payload missing a required field', () => {
    const { city: _drop, ...missingCity } = valid
    const result = ShippingAddress.safeParse(missingCity)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'city')).toBe(true)
    }
  })

  it('rejects wrong field types', () => {
    const result = ShippingAddress.safeParse({ ...valid, postal_code: 12345 })
    expect(result.success).toBe(false)
  })
})
