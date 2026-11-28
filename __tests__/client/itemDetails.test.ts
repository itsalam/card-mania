import {
  formatGain,
  formatGainPercent,
  gainRatio,
  normalizeSerial,
  toItemDetails,
  unrealizedGain,
} from '@/client/collections/item-details'

describe('unrealizedGain (ITS-137)', () => {
  it('is (market - cost) x quantity', () => {
    expect(unrealizedGain({ marketValueCents: 5000, costBasisCents: 3000, quantity: 3 })).toBe(6000)
    expect(unrealizedGain({ marketValueCents: 800, costBasisCents: 4000, quantity: 1 })).toBe(-3200)
  })

  it('is unknown without a cost basis, and zero cost is a real cost', () => {
    expect(unrealizedGain({ marketValueCents: 5000, costBasisCents: null, quantity: 3 })).toBeNull()
    expect(unrealizedGain({ marketValueCents: 5000, costBasisCents: 0, quantity: 1 })).toBe(5000)
  })
})

describe('gainRatio', () => {
  it('compares gain with cost', () => {
    expect(gainRatio(6000, 9000)).toBeCloseTo(0.6667)
  })

  it('has no ratio without a cost (or with a free card)', () => {
    expect(gainRatio(null, 9000)).toBeNull()
    expect(gainRatio(5000, 0)).toBeNull()
  })
})

describe('formatGain / formatGainPercent', () => {
  it('signs gains and losses', () => {
    expect(formatGain(125050)).toBe('+$1,250.50')
    expect(formatGain(-300)).toBe('−$3.00')
    expect(formatGain(0)).toBe('$0.00')
    expect(formatGainPercent(0.25)).toBe('+25.0%')
    expect(formatGainPercent(-0.032)).toBe('−3.2%')
  })
})

describe('normalizeSerial', () => {
  it('trims and treats blank as none', () => {
    expect(normalizeSerial(' 12/99 ')).toBe('12/99')
    expect(normalizeSerial('   ')).toBeNull()
  })
})

describe('toItemDetails', () => {
  it('maps the RPC row, keeping unknowns as null', () => {
    expect(
      toItemDetails({
        item_id: 'a',
        root_id: 'b',
        quantity: 2,
        serial_number: null,
        cost_basis_cents: null,
        condition_notes: null,
        market_value_cents: null,
        unrealized_cents: null,
      })
    ).toEqual({
      itemId: 'a',
      rootId: 'b',
      quantity: 2,
      serialNumber: null,
      costBasisCents: null,
      conditionNotes: null,
      marketValueCents: 0,
      unrealizedCents: null,
    })
  })
})
