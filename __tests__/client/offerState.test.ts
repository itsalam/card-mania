import {
  effectiveOfferStatus,
  formatTimeLeft,
  isMyTurn,
  matchesStatusFilters,
  offerResponder,
  OfferStatusFilter,
} from '@/client/offers/state'

const NOW = Date.parse('2026-11-24T12:00:00Z')
const inHours = (h: number) => new Date(NOW + h * 3_600_000).toISOString()

describe('offer state helpers (ITS-140)', () => {
  it('pending waits on the seller, countered on the buyer', () => {
    expect(offerResponder('pending')).toBe('seller')
    expect(offerResponder('countered')).toBe('buyer')
    expect(offerResponder('accepted')).toBeNull()
    expect(offerResponder('expired')).toBeNull()
  })

  it('shows a lapsed open offer as expired before the expirer runs', () => {
    expect(effectiveOfferStatus({ status: 'pending', expires_at: inHours(-1) }, NOW)).toBe(
      'expired'
    )
    expect(effectiveOfferStatus({ status: 'countered', expires_at: inHours(1) }, NOW)).toBe(
      'countered'
    )
    // Terminal states keep their status whatever expires_at says.
    expect(effectiveOfferStatus({ status: 'accepted', expires_at: inHours(-1) }, NOW)).toBe(
      'accepted'
    )
  })

  it('isMyTurn follows the responder and expiry', () => {
    const countered = { status: 'countered' as const, expires_at: inHours(5) }
    expect(isMyTurn(countered, 'buyer', NOW)).toBe(true)
    expect(isMyTurn(countered, 'seller', NOW)).toBe(false)
    expect(isMyTurn({ ...countered, expires_at: inHours(-1) }, 'buyer', NOW)).toBe(false)
  })

  it('formats the time left', () => {
    expect(formatTimeLeft(inHours(72), NOW)).toBe('3d 0h')
    expect(formatTimeLeft(inHours(5.5), NOW)).toBe('5h 30m')
    expect(formatTimeLeft(new Date(NOW + 30_000).toISOString(), NOW)).toBe('1m')
    expect(formatTimeLeft(inHours(-1), NOW)).toBeNull()
  })

  it('status filters: empty matches all, Active groups open and accepted', () => {
    const f = (...v: OfferStatusFilter[]) => new Set(v)
    const pending = { status: 'pending' as const, expires_at: inHours(1) }
    const lapsed = { status: 'pending' as const, expires_at: inHours(-1) }
    const accepted = { status: 'accepted' as const, expires_at: inHours(-100) }
    const declined = { status: 'declined' as const, expires_at: inHours(-100) }

    expect(matchesStatusFilters(declined, f(), NOW)).toBe(true)
    expect(matchesStatusFilters(pending, f('active'), NOW)).toBe(true)
    expect(matchesStatusFilters(accepted, f('active'), NOW)).toBe(true)
    expect(matchesStatusFilters(declined, f('active'), NOW)).toBe(false)
    expect(matchesStatusFilters(lapsed, f('active'), NOW)).toBe(false)
    expect(matchesStatusFilters(lapsed, f('expired'), NOW)).toBe(true)
    expect(matchesStatusFilters(lapsed, f('pending'), NOW)).toBe(false)
  })
})
