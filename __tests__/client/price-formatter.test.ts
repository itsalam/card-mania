import { formatPrice } from '@/components/utils'

describe('formatPrice', () => {
  it('formats a USD cents integer with the default currency', () => {
    expect(formatPrice(1999)).toBe('$19.99')
  })

  it('formats using a given currency code, symbol, locale and decimals', () => {
    expect(formatPrice(1999, { currencyCode: 'CAD' })).toBe('C$19.99')
    // TWD has 0 decimal places and a multiplier of 1.
    expect(formatPrice(150, { currencyCode: 'TWD' })).toBe('NT$150')
  })

  it('respects explicit fraction digit overrides', () => {
    expect(formatPrice(1000, { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe('$10')
  })

  it('handles undefined gracefully', () => {
    expect(formatPrice(undefined)).toBe('--.--')
  })

  it('handles null gracefully', () => {
    expect(formatPrice(null as unknown as number)).toBe('--.--')
  })

  it('treats a zero price the same as missing (falsy short-circuit)', () => {
    expect(formatPrice(0)).toBe('--.--')
  })
})
