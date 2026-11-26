import { cardPricesAsOf, formatPriceDate, splitOwnedValue } from '@/client/collections/valuation'

describe('splitOwnedValue (ITS-133)', () => {
  it('splits the Vault into PC and For Sale', () => {
    expect(splitOwnedValue(10_000, 2_500)).toEqual({ total: 10_000, pc: 7_500, forSale: 2_500 })
  })

  it('never lets For Sale exceed the total or go negative', () => {
    expect(splitOwnedValue(1_000, 5_000)).toEqual({ total: 1_000, pc: 0, forSale: 1_000 })
    expect(splitOwnedValue(1_000, -5)).toEqual({ total: 1_000, pc: 1_000, forSale: 0 })
  })
})

describe('cardPricesAsOf (ITS-133)', () => {
  it('takes the later of the scheduled refresh and the on-demand fetch', () => {
    expect(
      cardPricesAsOf({
        prices_refreshed_at: '2026-11-22T00:00:00Z',
        last_updated: '2026-11-01T00:00:00Z',
      })
    ).toBe('2026-11-22T00:00:00.000Z')
    expect(
      cardPricesAsOf({ prices_refreshed_at: null, last_updated: '2026-11-01T00:00:00Z' })
    ).toBe('2026-11-01T00:00:00.000Z')
  })

  it('is null when neither is known', () => {
    expect(cardPricesAsOf({})).toBeNull()
    expect(cardPricesAsOf(null)).toBeNull()
  })
})

describe('formatPriceDate (ITS-133)', () => {
  const now = new Date('2026-11-25T12:00:00Z')
  it('shows month and day this year, and the year otherwise', () => {
    expect(formatPriceDate('2026-11-20T12:00:00Z', now)).toBe('Nov 20')
    expect(formatPriceDate('2025-03-02T12:00:00Z', now)).toBe('Mar 2, 2025')
  })

  it('is null for missing or bad dates', () => {
    expect(formatPriceDate(null, now)).toBeNull()
    expect(formatPriceDate('not a date', now)).toBeNull()
  })
})
